import { DEFAULT_SAMPLE_CITY } from '../shared/aqi.ts';
import { normalizePlanningGroup } from '../shared/constants.ts';
import type {
  ChatMessage,
  EmissionFactors,
  ImpactAction,
  UserPreferences,
} from '../shared/types.ts';

const KEYS = {
  PREFS: 'airwise_preferences_v1',
  DAILY_HABITS: 'airwise_daily_habits_v1',
  IMPACT_ACTIONS: 'airwise_impact_actions_v1',
  EMISSION_FACTORS: 'airwise_emission_factors_v1',
  DEMO_MODE: 'airwise_demo_mode_v1',
  CHAT_HISTORY: 'airwise_chat_history_v1',
} as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  city: DEFAULT_SAMPLE_CITY,
  planningFor: 'family',
  commuteMethod: 'mixed',
  preferredScale: 'india',
  onboardingCompleted: false,
};

export const DEFAULT_EMISSION_FACTORS: EmissionFactors = {
  privateCarGPerKm: 171,
  twoWheelerGPerKm: 84,
  publicTransitGPerKm: 48,
  carpoolGPerKm: 85,
  walkCycleGPerKm: 0,
};

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEYS.PREFS);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    const rawCity = parsed.city;
    const validCity =
      rawCity &&
      typeof rawCity.name === 'string' &&
      typeof rawCity.latitude === 'number' &&
      Number.isFinite(rawCity.latitude) &&
      typeof rawCity.longitude === 'number' &&
      Number.isFinite(rawCity.longitude)
        ? rawCity
        : DEFAULT_SAMPLE_CITY;
    return {
      city: validCity,
      planningFor: normalizePlanningGroup(parsed.planningFor),
      commuteMethod:
        parsed.commuteMethod === 'walk_cycle' ||
        parsed.commuteMethod === 'public_transport' ||
        parsed.commuteMethod === 'private_vehicle' ||
        parsed.commuteMethod === 'mixed'
          ? parsed.commuteMethod
          : 'mixed',
      preferredScale: parsed.preferredScale === 'us' ? 'us' : 'india',
      onboardingCompleted: Boolean(parsed.onboardingCompleted),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(KEYS.PREFS, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

interface StoredDailyState {
  dateKey: string;
  completedIds: string[];
}

export function loadDailyHabitIds(): string[] {
  const today = getLocalDateKey();
  try {
    const raw = localStorage.getItem(KEYS.DAILY_HABITS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredDailyState;
    if (parsed.dateKey !== today) {
      // Automatically reset checklist when local date changes
      localStorage.setItem(
        KEYS.DAILY_HABITS,
        JSON.stringify({ dateKey: today, completedIds: [] }),
      );
      return [];
    }
    return Array.isArray(parsed.completedIds) ? parsed.completedIds : [];
  } catch {
    return [];
  }
}

export function saveDailyHabitIds(completedIds: string[]): void {
  try {
    const payload: StoredDailyState = {
      dateKey: getLocalDateKey(),
      completedIds,
    };
    localStorage.setItem(KEYS.DAILY_HABITS, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadImpactActions(): ImpactAction[] {
  try {
    const raw = localStorage.getItem(KEYS.IMPACT_ACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImpactAction[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ImpactAction =>
        Boolean(item) &&
        typeof item.id === 'string' &&
        typeof item.description === 'string' &&
        typeof item.co2AvoidedKg === 'number' &&
        Number.isFinite(item.co2AvoidedKg),
    );
  } catch {
    return [];
  }
}

export function saveImpactActions(actions: ImpactAction[]): void {
  try {
    localStorage.setItem(KEYS.IMPACT_ACTIONS, JSON.stringify(actions));
  } catch {
    // Ignore storage quota errors
  }
}

function sanitizeFactor(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : fallback;
}

export function loadEmissionFactors(): EmissionFactors {
  try {
    const raw = localStorage.getItem(KEYS.EMISSION_FACTORS);
    if (!raw) return DEFAULT_EMISSION_FACTORS;
    const parsed = JSON.parse(raw) as Partial<EmissionFactors>;
    return {
      privateCarGPerKm: sanitizeFactor(
        parsed.privateCarGPerKm,
        DEFAULT_EMISSION_FACTORS.privateCarGPerKm,
      ),
      twoWheelerGPerKm: sanitizeFactor(
        parsed.twoWheelerGPerKm,
        DEFAULT_EMISSION_FACTORS.twoWheelerGPerKm,
      ),
      publicTransitGPerKm: sanitizeFactor(
        parsed.publicTransitGPerKm,
        DEFAULT_EMISSION_FACTORS.publicTransitGPerKm,
      ),
      carpoolGPerKm: sanitizeFactor(
        parsed.carpoolGPerKm,
        DEFAULT_EMISSION_FACTORS.carpoolGPerKm,
      ),
      walkCycleGPerKm: 0,
    };
  } catch {
    return DEFAULT_EMISSION_FACTORS;
  }
}

export function saveEmissionFactors(factors: EmissionFactors): void {
  try {
    localStorage.setItem(KEYS.EMISSION_FACTORS, JSON.stringify(factors));
  } catch {
    // Ignore
  }
}

export function loadDemoMode(): boolean {
  try {
    return localStorage.getItem(KEYS.DEMO_MODE) === 'true';
  } catch {
    return false;
  }
}

export function saveDemoMode(enabled: boolean): void {
  try {
    localStorage.setItem(KEYS.DEMO_MODE, enabled ? 'true' : 'false');
  } catch {
    // Ignore
  }
}

export function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(KEYS.CHAT_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed.slice(-30) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(messages: ChatMessage[]): void {
  try {
    localStorage.setItem(
      KEYS.CHAT_HISTORY,
      JSON.stringify(messages.slice(-30)),
    );
  } catch {
    // Ignore
  }
}
