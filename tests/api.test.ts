import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../server/app.ts';
import {
  cleanChatFormatting,
  extractGeminiErrorInfo,
  extractGroundedPlaces,
  mapChatErrorToResponse,
  shouldUseMapsGrounding,
} from '../server/geminiService.ts';
import { buildDemoAirQuality, DEFAULT_SAMPLE_CITY } from '../src/shared/aqi.ts';

async function withServer(
  enableRateLimit: boolean,
  fn: (baseUrl: string) => Promise<void>,
) {
  const app = createApp({ enableRateLimit });
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

test('API routes enforce security headers, validation, demo AQI, advice, and chat bounds', async () => {
  await withServer(false, async (baseUrl) => {
    // 1. Health & security headers
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(healthRes.headers.get('x-powered-by'), null);
    const healthJson = (await healthRes.json()) as { ok: boolean };
    assert.equal(healthJson.ok, true);

    // 2. Demo AQI in India & US scales
    const indiaRes = await fetch(
      `${baseUrl}/api/aqi?demo=true&scale=india&city=Hyderabad&lat=17.385&lon=78.4867`,
    );
    assert.equal(indiaRes.status, 200);
    const indiaJson = (await indiaRes.json()) as {
      isDemo: boolean;
      scale: string;
      aqi: number;
    };
    assert.equal(indiaJson.isDemo, true);
    assert.equal(indiaJson.scale, 'india');
    assert.ok(indiaJson.aqi > 0);

    const usRes = await fetch(
      `${baseUrl}/api/aqi?demo=true&scale=us&city=Hyderabad&lat=17.385&lon=78.4867`,
    );
    assert.equal(usRes.status, 200);
    const usJson = (await usRes.json()) as { scale: string };
    assert.equal(usJson.scale, 'us');

    // 3. Invalid coordinates rejected with 400
    const badAqi = await fetch(`${baseUrl}/api/aqi?lat=999&lon=10`);
    assert.equal(badAqi.status, 400);

    const badReverse = await fetch(`${baseUrl}/api/cities/reverse?lat=abc&lon=10`);
    assert.equal(badReverse.status, 400);

    // 4. Empty search returns popular cities
    const searchRes = await fetch(`${baseUrl}/api/cities/search`);
    assert.equal(searchRes.status, 200);
    const searchJson = (await searchRes.json()) as { cities: unknown[] };
    assert.ok(searchJson.cities.length >= 5);

    // 5. Advice payload validation & deterministic/Gemini fallback
    const badAdvice = await fetch(`${baseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(badAdvice.status, 400);

    const demoAqi = buildDemoAirQuality(DEFAULT_SAMPLE_CITY, 'india');
    const goodAdvice = await fetch(`${baseUrl}/api/advice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aqiData: demoAqi,
        preferences: {
          city: DEFAULT_SAMPLE_CITY,
          planningFor: 'family',
          commuteMethod: 'public_transport',
          preferredScale: 'india',
          onboardingCompleted: true,
        },
      }),
    });
    assert.equal(goodAdvice.status, 200);
    const adviceJson = (await goodAdvice.json()) as {
      outdoor: string;
      outdoorWhy: string;
      indoor: string;
      indoorWhy: string;
      travel: string;
      travelWhy: string;
      summary: string;
    };
    assert.ok(adviceJson.outdoor.length > 0);
    assert.ok(adviceJson.outdoorWhy.length > 0);
    assert.ok(adviceJson.indoor.length > 0);
    assert.ok(adviceJson.indoorWhy.length > 0);
    assert.ok(adviceJson.travel.length > 0);
    assert.ok(adviceJson.travelWhy.length > 0);

    // 6. Chat input validation (empty, oversized, malformed JSON)
    const emptyChat = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    assert.equal(emptyChat.status, 400);

    const longChat = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'a'.repeat(2500) }),
    });
    assert.equal(longChat.status, 400);

    const malformedJson = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"message": ',
    });
    assert.equal(malformedJson.status, 400);
  });
});

test('AI rate limiter returns 429 after burst exceeds 20 requests', async () => {
  await withServer(true, async (baseUrl) => {
    let hit429 = false;
    for (let i = 0; i < 22; i++) {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      });
      if (res.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.equal(hit429, true);
  });
});

test('Gemini error mapping classifies status codes and SDK messages accurately', () => {
  const quotaErr = Object.assign(new Error('RESOURCE_EXHAUSTED'), { status: 429 });
  assert.equal(extractGeminiErrorInfo(quotaErr).isQuotaError, true);
  assert.equal(mapChatErrorToResponse(quotaErr).status, 429);

  const auth400Err = Object.assign(new Error('API_KEY_INVALID: API key not valid'), {
    status: 400,
  });
  assert.equal(extractGeminiErrorInfo(auth400Err).isAuthError, true);
  assert.equal(mapChatErrorToResponse(auth400Err).status, 403);

  const notFoundErr = Object.assign(new Error('Model not found'), { status: 404 });
  assert.equal(extractGeminiErrorInfo(notFoundErr).isNotFound, true);
  assert.equal(mapChatErrorToResponse(notFoundErr).status, 503);

  const badArgErr = Object.assign(new Error('INVALID_ARGUMENT'), { status: 400 });
  assert.equal(extractGeminiErrorInfo(badArgErr).isBadRequest, true);
  assert.equal(mapChatErrorToResponse(badArgErr).status, 400);

  const abortErr = new DOMException('The operation was aborted', 'AbortError');
  assert.equal(mapChatErrorToResponse(abortErr).status, 504);

  const fetchTimeoutErr = new TypeError('fetch failed', {
    cause: { code: 'UND_ERR_CONNECT_TIMEOUT', name: 'ConnectTimeoutError', message: 'Connect Timeout Error' },
  });
  assert.equal(extractGeminiErrorInfo(fetchTimeoutErr).isTimeout, true);
  assert.equal(mapChatErrorToResponse(fetchTimeoutErr).status, 504);

  const fetchResetErr = new TypeError('fetch failed', {
    cause: { code: 'ECONNRESET', message: 'read ECONNRESET' },
  });
  assert.equal(extractGeminiErrorInfo(fetchResetErr).isNetworkError, true);
  assert.equal(mapChatErrorToResponse(fetchResetErr).status, 503);

  const emptyErr = new Error('Empty response received from Gemini.');
  assert.equal(mapChatErrorToResponse(emptyErr).status, 503);

  const unknownErr = new Error('Unexpected serialization failure');
  assert.equal(mapChatErrorToResponse(unknownErr).status, 500);
});

test('cleanChatFormatting removes markdown symbols, headings, and dividers', () => {
  const messy = `### 1. Indoor Tips
***
*   **Run HEPA**: Traps \`PM2.5\` particles.
• Use *exhaust* fans while cooking.
---`;
  const cleaned = cleanChatFormatting(messy);
  assert.equal(cleaned.includes('#'), false);
  assert.equal(cleaned.includes('*'), false);
  assert.equal(cleaned.includes('---'), false);
  assert.equal(cleaned.includes('`'), false);
  assert.ok(cleaned.includes('1. Indoor Tips'));
  assert.ok(cleaned.includes('- Run HEPA: Traps PM2.5 particles.'));
  assert.ok(cleaned.includes('- Use exhaust fans while cooking.'));
});

test('Maps grounding intent and place chunk extraction enforce safe URLs', () => {
  assert.equal(shouldUseMapsGrounding('Where are clean parks nearby?'), true);
  assert.equal(shouldUseMapsGrounding('What is PM2.5?'), false);

  const places = extractGroundedPlaces([
    {
      maps: {
        uri: 'https://maps.google.com/?cid=123',
        title: 'Lodhi Garden',
        placeAnswerSources: {
          reviewSnippets: [{ content: 'Shaded paths away from traffic.' }],
        },
      },
    },
    {
      maps: {
        uri: 'javascript:alert(1)',
        title: 'Unsafe Link',
      },
    },
    {
      maps: {
        uri: 'https://maps.google.com/?cid=123',
        title: 'Duplicate Place',
      },
    },
  ]);

  assert.equal(places.length, 1);
  assert.equal(places[0].title, 'Lodhi Garden');
  assert.equal(places[0].uri, 'https://maps.google.com/?cid=123');
  assert.equal(places[0].snippet, 'Shaded paths away from traffic.');
});

test('Transcribe route enforces audio validation and microphone Permissions-Policy', async () => {
  await withServer(false, async (baseUrl) => {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.ok(
      (healthRes.headers.get('permissions-policy') || '').includes(
        'microphone=(self)',
      ),
    );

    const badMime = await fetch(`${baseUrl}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: 'AAAA', mimeType: 'text/plain' }),
    });
    assert.equal(badMime.status, 400);

    const emptyAudio = await fetch(`${baseUrl}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: '', mimeType: 'audio/webm' }),
    });
    assert.equal(emptyAudio.status, 400);

    const badBase64 = await fetch(`${baseUrl}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64: '***not-base64***', mimeType: 'audio/webm;codecs=opus' }),
    });
    assert.equal(badBase64.status, 400);
  });
});
