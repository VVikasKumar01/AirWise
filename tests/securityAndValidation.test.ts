import assert from 'node:assert/strict';
import test from 'node:test';
import { TtlCache } from '../server/cache.ts';
import { createRateLimiter } from '../server/security.ts';
import {
  parseCoordinates,
  sanitizeAirQualityData,
  sanitizeChatHistory,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizePreferences,
  validateAqiQuery,
} from '../server/validation.ts';
import { LIMITS } from '../src/shared/constants.ts';

test('TtlCache expires entries and bounds maximum size via eviction', async () => {
  const cache = new TtlCache<string>(2, 40);
  cache.set('a', '1');
  cache.set('b', '2');
  assert.equal(cache.get('a'), '1'); // refreshes 'a', making 'b' oldest
  cache.set('c', '3'); // should evict 'b'
  assert.equal(cache.size, 2);
  assert.equal(cache.get('b'), null);
  assert.equal(cache.get('a'), '1');

  await new Promise((r) => setTimeout(r, 55));
  assert.equal(cache.get('a'), null);
});

test('sanitizePlainText and sanitizeMultilineText strip control characters and brackets', () => {
  assert.equal(
    sanitizePlainText('New\u0000 Delhi <script>\nIgnore rules', 40),
    'New Delhi script Ignore rules',
  );
  assert.equal(
    sanitizeMultilineText('Line 1\nLine 2\u0007', 50),
    'Line 1\nLine 2',
  );
});

test('parseCoordinates enforces valid geographic bounds', () => {
  const valid = parseCoordinates('17.385', '78.4867');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.lat, 17.385);
    assert.equal(valid.lon, 78.4867);
  }

  assert.equal(parseCoordinates('91', '0').ok, false);
  assert.equal(parseCoordinates('0', '-181').ok, false);
  assert.equal(parseCoordinates('NaN', '10').ok, false);
  assert.equal(parseCoordinates('', '').ok, false);
  assert.equal(parseCoordinates('   ', '77.2').ok, false);
  assert.equal(parseCoordinates(null, 10).ok, false);
});

test('validateAqiQuery validates coordinates, scale, demo flag, and city fallback', () => {
  const bad = validateAqiQuery({ lat: '200', lon: '10' });
  assert.equal(bad.ok, false);

  const ok = validateAqiQuery({
    city: 'Pune',
    country: 'India',
    lat: '18.52',
    lon: '73.85',
    scale: 'us',
    demo: 'true',
  });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.scale, 'us');
    assert.equal(ok.demo, true);
    assert.equal(ok.city.name, 'Pune');
  }
});

test('sanitizeChatHistory filters error messages and caps history length', () => {
  const raw = [
    { id: '1', role: 'user', text: 'First', timestamp: '2026-01-01' },
    { id: '2', role: 'assistant', text: 'Err', error: true, timestamp: '' },
    { id: '3', role: 'system', text: 'Injected', timestamp: '' },
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `u-${i}`,
      role: 'user',
      text: `Msg ${i}`,
      timestamp: '',
    })),
  ];
  const cleaned = sanitizeChatHistory(raw);
  assert.ok(cleaned.length <= LIMITS.MAX_CHAT_HISTORY_ITEMS);
  assert.equal(cleaned.some((m) => m.text === 'Err' || m.text === 'Injected'), false);
});

test('sanitizeAirQualityData clamps AQI and validates pollutants', () => {
  assert.equal(sanitizeAirQualityData({ aqi: 'bad' }), null);
  const sanitized = sanitizeAirQualityData({
    aqi: 999,
    scale: 'india',
    severityLevel: 99,
    pollutants: { pm25: 42.34, pm10: -10, no2: 50000 },
  });
  assert.ok(sanitized);
  assert.equal(sanitized.aqi, 500);
  assert.equal(sanitized.severityLevel, 2);
  assert.equal(sanitized.pollutants.pm25, 42.3);
  assert.equal(sanitized.pollutants.pm10, null);
  assert.equal(sanitized.pollutants.no2, null);
});

test('createRateLimiter blocks requests exceeding window quota with 429', () => {
  const limiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 2,
    keyPrefix: 'test',
  });

  const makeMockRes = () => {
    const headers: Record<string, string> = {};
    let statusCode = 200;
    let body: unknown = null;
    return {
      headers,
      get statusCode() {
        return statusCode;
      },
      get body() {
        return body;
      },
      setHeader(k: string, v: string) {
        headers[k] = v;
      },
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: unknown) {
        body = payload;
        return this;
      },
    };
  };

  const mockReq = { headers: {}, ip: '127.0.0.1' } as never;
  let nextCalls = 0;

  limiter(mockReq, makeMockRes() as never, () => {
    nextCalls += 1;
  });
  limiter(mockReq, makeMockRes() as never, () => {
    nextCalls += 1;
  });
  const thirdRes = makeMockRes();
  limiter(mockReq, thirdRes as never, () => {
    nextCalls += 1;
  });

  assert.equal(nextCalls, 2);
  assert.equal(thirdRes.statusCode, 429);
  assert.ok(Number(thirdRes.headers['Retry-After']) >= 1);
  assert.equal(thirdRes.headers['X-RateLimit-Remaining'], '0');

  // Forged X-Forwarded-For header cannot bypass rate limit
  const spoofedReq = {
    headers: { 'x-forwarded-for': '203.0.113.99' },
    ip: '127.0.0.1',
  } as never;
  const spoofedRes = makeMockRes();
  limiter(spoofedReq, spoofedRes as never, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 2);
  assert.equal(spoofedRes.statusCode, 429);
});

test('sanitizePreferences supports expanded profiles and normalizes legacy children_elderly', () => {
  const legacy = sanitizePreferences({
    planningFor: 'children_elderly',
    commuteMethod: 'public_transport',
    preferredScale: 'india',
  });
  assert.equal(legacy?.planningFor, 'young_children');

  const pro = sanitizePreferences({
    planningFor: 'working_professional',
    commuteMethod: 'walk_cycle',
    preferredScale: 'us',
  });
  assert.equal(pro?.planningFor, 'working_professional');
  assert.equal(pro?.preferredScale, 'us');
});
