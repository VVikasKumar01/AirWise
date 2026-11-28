import { DEFAULT_SAMPLE_CITY } from '../src/shared/aqi.ts';
import { LIMITS, normalizePlanningGroup } from '../src/shared/constants.ts';
import { isSafeHttpUrl } from '../src/shared/text.ts';
import type {
  AirQualityData,
  AqiScale,
  ChatMessage,
  CityLocation,
  CommuteMethod,
  PlanningGroup,
  PollutantReadings,
  SeverityLevel,
  UserPreferences,
} from '../src/shared/types.ts';

const VALID_PLANNING_GROUPS = new Set<PlanningGroup>([
  'just_me',
  'working_professional',
  'family',
  'young_children',
  'senior_citizens',
  'sensitive',
]);

const VALID_COMMUTE_METHODS = new Set<CommuteMethod>([
  'walk_cycle',
  'public_transport',
  'private_vehicle',
  'mixed',
]);

/**
 * Strips ASCII control characters (except spaces) and caps length to mitigate
 * prompt injection and log/response pollution.
 */
export function sanitizePlainText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeMultilineText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

function toStrictFiniteNumber(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
  return Number.NaN;
}

export function parseCoordinates(
  rawLat: unknown,
  rawLon: unknown,
): { ok: true; lat: number; lon: number } | { ok: false; error: string } {
  const lat = toStrictFiniteNumber(rawLat);
  const lon = toStrictFiniteNumber(rawLon);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return {
      ok: false,
      error:
        'Coordinates must be valid numbers (latitude -90..90, longitude -180..180).',
    };
  }
  return { ok: true, lat, lon };
}

export function validateAqiQuery(query: Record<string, unknown>):
  | {
      ok: true;
      city: CityLocation;
      scale: AqiScale;
      demo: boolean;
    }
  | { ok: false; error: string } {
  const scale: AqiScale = query.scale === 'us' ? 'us' : 'india';
  const demo = query.demo === 'true';

  const hasLat = query.lat !== undefined && query.lat !== '';
  const hasLon = query.lon !== undefined && query.lon !== '';

  let lat = DEFAULT_SAMPLE_CITY.latitude;
  let lon = DEFAULT_SAMPLE_CITY.longitude;

  if (hasLat || hasLon) {
    const parsed = parseCoordinates(query.lat, query.lon);
    if (!parsed.ok) return parsed;
    lat = parsed.lat;
    lon = parsed.lon;
  }

  const cityName =
    sanitizePlainText(query.city, LIMITS.MAX_CITY_NAME_CHARS) ||
    DEFAULT_SAMPLE_CITY.name;
  const region =
    sanitizePlainText(query.region, LIMITS.MAX_CITY_NAME_CHARS) || undefined;
  const country =
    sanitizePlainText(query.country, LIMITS.MAX_CITY_NAME_CHARS) ||
    DEFAULT_SAMPLE_CITY.country;
  const id =
    sanitizePlainText(query.id, 80) ||
    `${cityName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${lat.toFixed(2)}`;

  return {
    ok: true,
    scale,
    demo,
    city: {
      id,
      name: cityName,
      region,
      country,
      latitude: lat,
      longitude: lon,
      isSample: query.sample === 'true',
    },
  };
}

function sanitizeNumberOrNull(val: unknown, min: number, max: number): number | null {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  if (val < min || val > max) return null;
  return Math.round(val * 10) / 10;
}

export function sanitizeCity(raw: unknown): CityLocation {
  if (!raw || typeof raw !== 'object') return DEFAULT_SAMPLE_CITY;
  const c = raw as Record<string, unknown>;
  const coords = parseCoordinates(c.latitude, c.longitude);
  return {
    id: sanitizePlainText(c.id, 80) || DEFAULT_SAMPLE_CITY.id,
    name:
      sanitizePlainText(c.name, LIMITS.MAX_CITY_NAME_CHARS) ||
      DEFAULT_SAMPLE_CITY.name,
    region: sanitizePlainText(c.region, LIMITS.MAX_CITY_NAME_CHARS) || undefined,
    country: sanitizePlainText(c.country, LIMITS.MAX_CITY_NAME_CHARS) || '',
    latitude: coords.ok ? coords.lat : DEFAULT_SAMPLE_CITY.latitude,
    longitude: coords.ok ? coords.lon : DEFAULT_SAMPLE_CITY.longitude,
    isSample: Boolean(c.isSample),
  };
}

export function sanitizePreferences(raw: unknown): UserPreferences | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const normalizedGroup = normalizePlanningGroup(p.planningFor);
  const planningFor: PlanningGroup = VALID_PLANNING_GROUPS.has(normalizedGroup)
    ? normalizedGroup
    : 'family';
  const commuteMethod: CommuteMethod = VALID_COMMUTE_METHODS.has(
    p.commuteMethod as CommuteMethod,
  )
    ? (p.commuteMethod as CommuteMethod)
    : 'mixed';
  const preferredScale: AqiScale = p.preferredScale === 'us' ? 'us' : 'india';

  return {
    city: sanitizeCity(p.city),
    planningFor,
    commuteMethod,
    preferredScale,
    onboardingCompleted: Boolean(p.onboardingCompleted),
  };
}

export function sanitizeAirQualityData(raw: unknown): AirQualityData | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  if (typeof d.aqi !== 'number' || !Number.isFinite(d.aqi)) return null;

  const scale: AqiScale = d.scale === 'us' ? 'us' : 'india';
  const clampedAqi = Math.max(0, Math.min(500, Math.round(d.aqi)));
  const rawSeverity = Number(d.severityLevel);
  const severityLevel: SeverityLevel =
    rawSeverity >= 1 && rawSeverity <= 6 && Number.isInteger(rawSeverity)
      ? (rawSeverity as SeverityLevel)
      : 2;

  const rawPol =
    d.pollutants && typeof d.pollutants === 'object'
      ? (d.pollutants as Record<string, unknown>)
      : {};
  const pollutants: PollutantReadings = {
    pm25: sanitizeNumberOrNull(rawPol.pm25, 0, 2000),
    pm10: sanitizeNumberOrNull(rawPol.pm10, 0, 3000),
    no2: sanitizeNumberOrNull(rawPol.no2, 0, 2000),
    o3: sanitizeNumberOrNull(rawPol.o3, 0, 2000),
    so2: sanitizeNumberOrNull(rawPol.so2, 0, 3000),
    co: sanitizeNumberOrNull(rawPol.co, 0, 100000),
  };

  return {
    city: sanitizeCity(d.city),
    scale,
    aqi: clampedAqi,
    categoryLabel:
      sanitizePlainText(d.categoryLabel, 48) || 'Moderate',
    severityLevel,
    explanation: sanitizePlainText(d.explanation, 280),
    dominantPollutant:
      sanitizePlainText(d.dominantPollutant, 16) || null,
    pollutants,
    measuredAt: sanitizePlainText(d.measuredAt, 40) || new Date().toISOString(),
    fetchedAt: sanitizePlainText(d.fetchedAt, 40) || new Date().toISOString(),
    isStale: Boolean(d.isStale),
    isDemo: Boolean(d.isDemo),
    dataSource: sanitizePlainText(d.dataSource, 60) || 'Air Quality Feed',
    notice: sanitizePlainText(d.notice, 200) || undefined,
  };
}

export function sanitizeChatHistory(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ChatMessage[] = [];
  for (const item of raw.slice(-LIMITS.MAX_CHAT_HISTORY_ITEMS)) {
    if (!item || typeof item !== 'object') continue;
    const msg = item as Record<string, unknown>;
    if (msg.error) continue;
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    const text = sanitizeMultilineText(msg.text, LIMITS.MAX_CHAT_MESSAGE_CHARS);
    if (!text) continue;
    cleaned.push({
      id: sanitizePlainText(msg.id, 60) || `m-${cleaned.length}`,
      role: msg.role,
      text,
      timestamp: sanitizePlainText(msg.timestamp, 40) || '',
    });
  }
  return cleaned;
}

export function sanitizeRecentActions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, LIMITS.MAX_RECENT_ACTIONS)
    .map((item) => sanitizePlainText(item, LIMITS.MAX_ACTION_TEXT_CHARS))
    .filter((s) => s.length > 0);
}

export { isSafeHttpUrl };

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
]);

const MAX_AUDIO_BASE64_CHARS = 2_400_000;

export function sanitizeAudioPayload(
  raw: unknown,
):
  | { ok: true; audioBase64: string; mimeType: string }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Audio payload is required.' };
  }
  const body = raw as Record<string, unknown>;
  const rawMime = typeof body.mimeType === 'string' ? body.mimeType : '';
  const baseMime = rawMime.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_AUDIO_MIME_TYPES.has(baseMime)) {
    return {
      ok: false,
      error: 'Unsupported audio format. Please record with a standard microphone format.',
    };
  }

  const rawData = typeof body.audioBase64 === 'string' ? body.audioBase64.trim() : '';
  if (!rawData) {
    return { ok: false, error: 'Recorded audio is empty.' };
  }
  if (rawData.length > MAX_AUDIO_BASE64_CHARS) {
    return {
      ok: false,
      error: 'Audio clip is too long. Please keep voice questions under 45 seconds.',
    };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(rawData)) {
    return { ok: false, error: 'Invalid audio data encoding.' };
  }

  return { ok: true, audioBase64: rawData, mimeType: baseMime };
}
