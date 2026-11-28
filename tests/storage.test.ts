import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import {
  DEFAULT_EMISSION_FACTORS,
  DEFAULT_PREFERENCES,
  getLocalDateKey,
  loadDailyHabitIds,
  loadEmissionFactors,
  loadImpactActions,
  loadPreferences,
  saveChatHistory,
  saveDailyHabitIds,
  saveDemoMode,
  saveEmissionFactors,
  saveImpactActions,
  savePreferences,
} from '../src/utils/storage.ts';
import type { ChatMessage } from '../src/shared/types.ts';

const values = new Map<string, string>();
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, String(value)),
    },
  });
});

afterEach(() => {
  if (previousStorage) {
    Object.defineProperty(globalThis, 'localStorage', previousStorage);
  } else {
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('preferences fall back safely when stored JSON is invalid', () => {
  values.set('airwise_preferences_v1', '{broken json');
  assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES);
});

test('daily habits save for today and reset when the saved date is old', () => {
  saveDailyHabitIds(['morning-water', 'evening-walk']);
  assert.deepEqual(loadDailyHabitIds(), ['morning-water', 'evening-walk']);

  values.set(
    'airwise_daily_habits_v1',
    JSON.stringify({ dateKey: '2000-01-01', completedIds: ['old-habit'] }),
  );
  assert.deepEqual(loadDailyHabitIds(), []);
  assert.deepEqual(JSON.parse(values.get('airwise_daily_habits_v1') || '{}'), {
    dateKey: getLocalDateKey(),
    completedIds: [],
  });
});

test('emission factors sanitize invalid values and keep walking at zero', () => {
  values.set(
    'airwise_emission_factors_v1',
    JSON.stringify({ privateCarGPerKm: -1, publicTransitGPerKm: 52 }),
  );
  assert.deepEqual(loadEmissionFactors(), {
    ...DEFAULT_EMISSION_FACTORS,
    publicTransitGPerKm: 52,
  });

  saveEmissionFactors({ ...DEFAULT_EMISSION_FACTORS, privateCarGPerKm: 190 });
  assert.equal(loadEmissionFactors().privateCarGPerKm, 190);
});

test('impact actions discard malformed records', () => {
  values.set(
    'airwise_impact_actions_v1',
    JSON.stringify([
      { id: 'valid', description: 'Took the bus', co2AvoidedKg: 1.2 },
      { id: 'bad-number', description: 'Bad', co2AvoidedKg: Number.NaN },
      { id: 7, description: 'Bad ID', co2AvoidedKg: 1 },
    ]),
  );
  assert.deepEqual(loadImpactActions(), [
    { id: 'valid', description: 'Took the bus', co2AvoidedKg: 1.2 },
  ]);
});

test('chat history is bounded and storage helpers tolerate quota errors', () => {
  const messages: ChatMessage[] = Array.from({ length: 35 }, (_, index) => ({
    id: `m-${index}`,
    role: 'user',
    text: `Message ${index}`,
    timestamp: '',
  }));
  saveChatHistory(messages);
  assert.equal(JSON.parse(values.get('airwise_chat_history_v1') || '[]').length, 30);

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: () => { throw new Error('storage unavailable'); },
      setItem: () => { throw new Error('quota exceeded'); },
    },
  });
  assert.deepEqual(loadPreferences(), DEFAULT_PREFERENCES);
  assert.doesNotThrow(() => {
    savePreferences(DEFAULT_PREFERENCES);
    saveImpactActions([]);
    saveDemoMode(true);
  });
});
