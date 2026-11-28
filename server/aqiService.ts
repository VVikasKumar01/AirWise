import {
  categorizeAqi,
  computeIndiaNaqi,
  computeUsAqiFallback,
  POPULAR_CITIES,
} from '../src/shared/aqi.ts';
import type {
  AirQualityData,
  AqiScale,
  CityLocation,
  PollutantReadings,
} from '../src/shared/types.ts';
import { TtlCache } from './cache.ts';

const CACHE_TTL_MS = 10 * 60 * 1000;
const GEOCODE_TTL_MS = 15 * 60 * 1000;
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export interface RawHourlyPoint {
  time: string;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}

export interface CachedAqiEntry {
  fetchedAtMs: number;
  measuredAt: string;
  pollutants: PollutantReadings;
  openMeteoUsAqi: number | null;
  hourlyRaw: RawHourlyPoint[];
  dataSource: string;
}

const aqiCache = new TtlCache<CachedAqiEntry>(500, CACHE_TTL_MS);
const geocodeCache = new TtlCache<CityLocation[]>(300, GEOCODE_TTL_MS);
const reverseCache = new TtlCache<CityLocation>(300, GEOCODE_TTL_MS);

const pendingAqi = new Map<string, Promise<CachedAqiEntry>>();
const pendingGeocode = new Map<string, Promise<{ cities: CityLocation[]; notice?: string }>>();
const pendingReverse = new Map<string, Promise<CityLocation>>();

export function clearAqiServiceCaches(): void {
  aqiCache.clear();
  geocodeCache.clear();
  reverseCache.clear();
  pendingAqi.clear();
  pendingGeocode.clear();
  pendingReverse.clear();
}

export function normalizeGmtIso(raw?: string): string {
  if (!raw) return new Date().toISOString();
  const normalized = raw.endsWith('Z')
    ? raw
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)
      ? `${raw}:00Z`
      : `${raw}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed)
    ? new Date().toISOString()
    : new Date(parsed).toISOString();
}

export function formatAqiFromRaw(
  city: CityLocation,
  scale: AqiScale,
  entry: CachedAqiEntry,
): AirQualityData {
  let aqi = 0;
  let dominantPollutant: string | null = null;

  if (scale === 'india') {
    const computed = computeIndiaNaqi(entry.pollutants);
    aqi = computed.aqi;
    dominantPollutant = computed.dominantPollutant;
  } else if (
    entry.openMeteoUsAqi !== null &&
    !Number.isNaN(entry.openMeteoUsAqi)
  ) {
    aqi = Math.round(entry.openMeteoUsAqi);
    dominantPollutant = computeUsAqiFallback(entry.pollutants).dominantPollutant;
  } else {
    const computed = computeUsAqiFallback(entry.pollutants);
    aqi = computed.aqi;
    dominantPollutant = computed.dominantPollutant;
  }

  const categorized = categorizeAqi(aqi, scale);
  const measuredMs = Date.parse(entry.measuredAt);
  const isStale =
    Number.isNaN(measuredMs) || Date.now() - measuredMs > STALE_THRESHOLD_MS;

  const baseMs = Number.isNaN(measuredMs) ? Date.now() : measuredMs;
  const upcoming = entry.hourlyRaw.filter((pt) => {
    const ms = Date.parse(pt.time);
    return !Number.isNaN(ms) && ms > baseMs;
  });
  const selectedFuture = [upcoming[1], upcoming[3], upcoming[5]].filter(
    (x): x is RawHourlyPoint => Boolean(x),
  );

  const hourly = [
    {
      timeLabel: 'Now',
      isoTime: entry.measuredAt,
      aqi,
      severityLevel: categorized.severityLevel,
    },
    ...selectedFuture.map((pt) => {
      const ptPollutants: PollutantReadings = {
        pm25: pt.pm25,
        pm10: pt.pm10,
        no2: pt.no2,
        o3: pt.o3,
        so2: null,
        co: null,
      };
      const ptAqi =
        scale === 'india'
          ? computeIndiaNaqi(ptPollutants).aqi
          : pt.usAqi !== null
            ? Math.round(pt.usAqi)
            : computeUsAqiFallback(ptPollutants).aqi;
      const ptCat = categorizeAqi(ptAqi, scale);
      return {
        timeLabel: pt.time,
        isoTime: pt.time,
        aqi: ptAqi,
        severityLevel: ptCat.severityLevel,
      };
    }),
  ];

  return {
    city,
    scale,
    aqi,
    categoryLabel: categorized.categoryLabel,
    severityLevel: categorized.severityLevel,
    explanation: categorized.explanation,
    dominantPollutant,
    pollutants: entry.pollutants,
    hourly,
    measuredAt: entry.measuredAt,
    fetchedAt: new Date(entry.fetchedAtMs).toISOString(),
    isStale,
    isDemo: false,
    dataSource: entry.dataSource,
    notice: isStale
      ? 'Station measurements are more than 2 hours old and may not reflect sudden local changes.'
      : undefined,
  };
}

export async function fetchLiveAirQuality(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CachedAqiEntry> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = aqiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existing = pendingAqi.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<CachedAqiEntry> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
      url.searchParams.set('latitude', String(lat));
      url.searchParams.set('longitude', String(lon));
      url.searchParams.set(
        'current',
        'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,sulphur_dioxide,carbon_monoxide',
      );
      url.searchParams.set(
        'hourly',
        'us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone',
      );
      url.searchParams.set('forecast_days', '2');
      url.searchParams.set('timezone', 'GMT');

      const response = await fetchImpl(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Upstream air quality API responded with ${response.status}`);
      }

    const json = (await response.json()) as {
      current?: {
        time?: string;
        us_aqi?: number | null;
        pm2_5?: number | null;
        pm10?: number | null;
        nitrogen_dioxide?: number | null;
        ozone?: number | null;
        sulphur_dioxide?: number | null;
        carbon_monoxide?: number | null;
      };
      hourly?: {
        time?: string[];
        us_aqi?: Array<number | null>;
        pm2_5?: Array<number | null>;
        pm10?: Array<number | null>;
        nitrogen_dioxide?: Array<number | null>;
        ozone?: Array<number | null>;
      };
    };

    if (!json.current) {
      throw new Error('Upstream response missing current air quality readings.');
    }

    const c = json.current;
    const isoMeasured = normalizeGmtIso(c.time);

    const hTimes = json.hourly?.time || [];
    const hourlyRaw: RawHourlyPoint[] = hTimes.map((t, i) => ({
      time: normalizeGmtIso(t),
      usAqi: json.hourly?.us_aqi?.[i] ?? null,
      pm25: json.hourly?.pm2_5?.[i] ?? null,
      pm10: json.hourly?.pm10?.[i] ?? null,
      no2: json.hourly?.nitrogen_dioxide?.[i] ?? null,
      o3: json.hourly?.ozone?.[i] ?? null,
    }));

    const entry: CachedAqiEntry = {
      fetchedAtMs: Date.now(),
      measuredAt: isoMeasured,
      openMeteoUsAqi: typeof c.us_aqi === 'number' ? c.us_aqi : null,
      pollutants: {
        pm25: typeof c.pm2_5 === 'number' ? Math.round(c.pm2_5 * 10) / 10 : null,
        pm10: typeof c.pm10 === 'number' ? Math.round(c.pm10 * 10) / 10 : null,
        no2:
          typeof c.nitrogen_dioxide === 'number'
            ? Math.round(c.nitrogen_dioxide * 10) / 10
            : null,
        o3: typeof c.ozone === 'number' ? Math.round(c.ozone * 10) / 10 : null,
        so2:
          typeof c.sulphur_dioxide === 'number'
            ? Math.round(c.sulphur_dioxide * 10) / 10
            : null,
        co:
          typeof c.carbon_monoxide === 'number'
            ? Math.round(c.carbon_monoxide)
            : null,
      },
      hourlyRaw,
      dataSource: 'Open-Meteo Air Quality',
    };

      aqiCache.set(cacheKey, entry);
      return entry;
    } finally {
      clearTimeout(timeout);
    }
  })();

  pendingAqi.set(cacheKey, task);
  void task.finally(() => pendingAqi.delete(cacheKey)).catch(() => {});
  return task;
}

export async function searchCities(
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ cities: CityLocation[]; notice?: string }> {
  const lower = query.toLowerCase();
  const cached = geocodeCache.get(lower);
  if (cached) {
    return { cities: cached };
  }

  const existing = pendingGeocode.get(lower);
  if (existing) return existing;

  const task = (async (): Promise<{ cities: CityLocation[]; notice?: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.searchParams.set('name', query);
      url.searchParams.set('count', '8');
      url.searchParams.set('language', 'en');
      url.searchParams.set('format', 'json');

      const response = await fetchImpl(url.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Geocoding error ${response.status}`);
    }
    const data = (await response.json()) as {
      results?: Array<{
        id: number;
        name: string;
        admin1?: string;
        country?: string;
        latitude: number;
        longitude: number;
      }>;
    };

    const cities: CityLocation[] = (data.results || []).map((item) => ({
      id: `om-${item.id}`,
      name: item.name,
      region: item.admin1,
      country: item.country || '',
      latitude: item.latitude,
      longitude: item.longitude,
    }));

    geocodeCache.set(lower, cities);
    return { cities };
  } catch {
    const filtered = POPULAR_CITIES.filter(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.country.toLowerCase().includes(lower) ||
        (c.region && c.region.toLowerCase().includes(lower)),
    );
      return {
        cities: filtered,
        notice: 'City search offline — showing matching saved cities.',
      };
    } finally {
      clearTimeout(timeout);
    }
  })();

  pendingGeocode.set(lower, task);
  void task.finally(() => pendingGeocode.delete(lower)).catch(() => {});
  return task;
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<CityLocation> {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached) return cached;

  const existing = pendingReverse.get(cacheKey);
  if (existing) return existing;

  const task = (async (): Promise<CityLocation> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/reverse');
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('zoom', '10');

      const response = await fetchImpl(url.toString(), {
        headers: { 'User-Agent': 'AirWise-UrbanAirAssistant/1.0' },
        signal: controller.signal,
      });

    if (!response.ok) {
      throw new Error('Reverse geocode failed');
    }

    const data = (await response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        state_district?: string;
        state?: string;
        country?: string;
      };
    };

    const addr = data.address || {};
    const name =
      addr.city ||
      addr.town ||
      addr.village ||
      addr.state_district ||
      'Your Location';

    const city: CityLocation = {
      id: `geo-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      name,
      region: addr.state,
      country: addr.country || 'Current Area',
      latitude: lat,
      longitude: lon,
    };
    reverseCache.set(cacheKey, city);
    return city;
  } catch {
    return {
      id: `geo-${lat.toFixed(2)}-${lon.toFixed(2)}`,
      name: 'Current Location',
      country: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      latitude: lat,
      longitude: lon,
    };
    } finally {
      clearTimeout(timeout);
    }
  })();

  pendingReverse.set(cacheKey, task);
  void task.finally(() => pendingReverse.delete(cacheKey)).catch(() => {});
  return task;
}
