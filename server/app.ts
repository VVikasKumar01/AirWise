import express from 'express';
import { buildDemoAirQuality, POPULAR_CITIES } from '../src/shared/aqi.ts';
import { LIMITS } from '../src/shared/constants.ts';
import {
  fetchLiveAirQuality,
  formatAqiFromRaw,
  reverseGeocode,
  searchCities,
} from './aqiService.ts';
import {
  generateChatReply,
  generatePersonalizedAdvice,
  isGeminiConfigured,
  transcribeAudio,
} from './geminiService.ts';
import { createRateLimiter, securityHeaders } from './security.ts';
import { asyncHandler } from './asyncHandler.ts';
import { apiErrorHandler } from './errorHandler.ts';
import {
  parseCoordinates,
  sanitizeAirQualityData,
  sanitizeAudioPayload,
  sanitizeChatHistory,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizePreferences,
  sanitizeRecentActions,
  validateAqiQuery,
} from './validation.ts';

export interface CreateAppOptions {
  enableRateLimit?: boolean;
}

export function createApp(options: CreateAppOptions = {}) {
  const enableRateLimit = options.enableRateLimit !== false;
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);

  const standardLimiter = enableRateLimit
    ? createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 60,
        keyPrefix: 'std',
      })
    : (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

  const aiLimiter = enableRateLimit
    ? createRateLimiter({
        windowMs: 60 * 1000,
        maxRequests: 20,
        keyPrefix: 'ai',
        message:
          'You are sending AI requests quickly. Please wait a moment before trying again.',
      })
    : (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

  app.post(
    '/api/transcribe',
    aiLimiter,
    express.json({ limit: '2.5mb' }),
    asyncHandler(async (req, res) => {
      const validated = sanitizeAudioPayload(req.body);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const result = await transcribeAudio({
        audioBase64: validated.audioBase64,
        mimeType: validated.mimeType,
      });

      if ('error' in result) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.json(result);
    }),
  );

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, geminiConfigured: isGeminiConfigured() });
  });

  app.get(
    '/api/cities/search',
    standardLimiter,
    asyncHandler(async (req, res) => {
      const query = sanitizePlainText(req.query.q, LIMITS.MAX_CITY_QUERY_CHARS);
      if (!query) {
        res.json({ cities: POPULAR_CITIES });
        return;
      }

      const result = await searchCities(query);
      res.json(result);
    }),
  );

  app.get(
    '/api/cities/reverse',
    standardLimiter,
    asyncHandler(async (req, res) => {
      const parsed = parseCoordinates(req.query.lat, req.query.lon);
      if (!parsed.ok) {
        res.status(400).json({ error: parsed.error });
        return;
      }

      const city = await reverseGeocode(parsed.lat, parsed.lon);
      res.json({ city });
    }),
  );

  app.get(
    '/api/aqi',
    standardLimiter,
    asyncHandler(async (req, res) => {
      const validated = validateAqiQuery(req.query as Record<string, unknown>);
      if (!validated.ok) {
        res.status(400).json({ error: validated.error });
        return;
      }

      const { city, scale, demo } = validated;

      if (demo) {
        res.json(
          buildDemoAirQuality(
            city,
            scale,
            'Demo Mode is active. Values below are sample figures for exploring AirWise, not live station readings.',
          ),
        );
        return;
      }

      try {
        const entry = await fetchLiveAirQuality(city.latitude, city.longitude);
        res.json(formatAqiFromRaw(city, scale, entry));
      } catch (err) {
        console.error('/api/aqi upstream error:', err);
        res.status(503).json({
          error:
            'Live air quality data could not be reached right now. Please try again or switch to Demo Mode to view clearly labeled sample figures.',
          demoData: buildDemoAirQuality(
            city,
            scale,
            'Live air quality service is unreachable. Showing clearly labeled sample data.',
          ),
        });
      }
    }),
  );

  app.post('/api/advice', aiLimiter, asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const aqiData = sanitizeAirQualityData(body?.aqiData);
    const preferences = sanitizePreferences(body?.preferences);

    if (!aqiData || !preferences) {
      res.status(400).json({
        error: 'Valid aqiData and preferences payloads are required.',
      });
      return;
    }

    const result = await generatePersonalizedAdvice(aqiData, preferences);
    res.json(result);
  }));

  app.post('/api/chat', aiLimiter, asyncHandler(async (req, res) => {
    const body = req.body as Record<string, unknown> | undefined;
    const rawMsg = typeof body?.message === 'string' ? body.message : '';
    const trimmed = sanitizeMultilineText(rawMsg, LIMITS.MAX_CHAT_MESSAGE_CHARS);

    if (!trimmed) {
      res.status(400).json({ error: 'Please enter a message.' });
      return;
    }

    if (rawMsg.trim().length > LIMITS.MAX_CHAT_MESSAGE_CHARS) {
      res.status(400).json({
        error: `Message must be ${LIMITS.MAX_CHAT_MESSAGE_CHARS} characters or fewer.`,
      });
      return;
    }

    const rawCtx =
      body?.context && typeof body.context === 'object'
        ? (body.context as Record<string, unknown>)
        : {};

    const result = await generateChatReply({
      message: trimmed,
      history: sanitizeChatHistory(body?.history),
      aqiData: sanitizeAirQualityData(rawCtx.aqiData),
      preferences: sanitizePreferences(rawCtx.preferences),
      recentActions: sanitizeRecentActions(rawCtx.recentActions),
    });

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json(result);
  }));

  // Keep parser and async route failures in one safe JSON error path.
  app.use(apiErrorHandler);

  return app;
}
