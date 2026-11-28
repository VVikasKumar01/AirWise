import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearAqiServiceCaches,
  fetchLiveAirQuality,
  normalizeGmtIso,
  reverseGeocode,
  searchCities,
} from '../server/aqiService.ts';
import { isSafeHttpUrl, stripInlineMarkdown } from '../src/shared/text.ts';

test('normalizeGmtIso normalizes Open-Meteo timestamps with or without seconds', () => {
  assert.equal(normalizeGmtIso('2026-11-28T09:00'), '2026-11-28T09:00:00.000Z');
  assert.equal(normalizeGmtIso('2026-11-28T09:00:00Z'), '2026-11-28T09:00:00.000Z');
  assert.equal(normalizeGmtIso('2026-11-28T09:00:00'), '2026-11-28T09:00:00.000Z');
});

test('fetchLiveAirQuality deduplicates concurrent in-flight requests and caches results', async () => {
  clearAqiServiceCaches();
  let fetchCount = 0;

  const mockFetch = (async () => {
    fetchCount += 1;
    await new Promise((r) => setTimeout(r, 20));
    return new Response(
      JSON.stringify({
        current: {
          time: '2026-11-28T09:00',
          us_aqi: 74,
          pm2_5: 22.44,
          pm10: 41.2,
          nitrogen_dioxide: 18.1,
          ozone: 33.5,
          sulphur_dioxide: 6.2,
          carbon_monoxide: 410,
        },
        hourly: {
          time: ['2026-11-28T09:00', '2026-11-28T10:00'],
          us_aqi: [74, 68],
          pm2_5: [22.4, 20.1],
          pm10: [41.2, 38.0],
          nitrogen_dioxide: [18.1, 16.0],
          ozone: [33.5, 35.0],
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;

  const [first, second] = await Promise.all([
    fetchLiveAirQuality(28.61, 77.21, mockFetch),
    fetchLiveAirQuality(28.61, 77.21, mockFetch),
  ]);

  assert.equal(fetchCount, 1);
  assert.equal(first.pollutants.pm25, 22.4);
  assert.equal(second.openMeteoUsAqi, 74);

  // Subsequent call hits TTL cache without fetching
  await fetchLiveAirQuality(28.61, 77.21, mockFetch);
  assert.equal(fetchCount, 1);
});

test('searchCities and reverseGeocode degrade gracefully when upstream fails', async () => {
  clearAqiServiceCaches();
  const failingFetch = (async () => {
    throw new Error('Network unreachable');
  }) as unknown as typeof fetch;

  const searchRes = await searchCities('Delhi', failingFetch);
  assert.ok(searchRes.cities.some((c) => c.name.includes('Delhi')));
  assert.ok(searchRes.notice?.includes('offline'));

  const reverseRes = await reverseGeocode(19.08, 72.88, failingFetch);
  assert.equal(reverseRes.name, 'Current Location');
  assert.equal(reverseRes.country, '19.08, 72.88');
});

test('shared text helpers enforce safe http/https URLs and strip inline markdown', () => {
  assert.equal(isSafeHttpUrl('https://maps.google.com/?q=park'), true);
  assert.equal(isSafeHttpUrl('http://example.com'), true);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>'), false);

  assert.equal(
    stripInlineMarkdown('**Use HEPA** and *exhaust* `fans`'),
    'Use HEPA and exhaust fans',
  );
});
