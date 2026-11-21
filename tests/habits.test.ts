import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDemoAirQuality, DEFAULT_SAMPLE_CITY } from '../src/shared/aqi.ts';
import type { UserPreferences } from '../src/shared/types.ts';
import {
  getAdaptiveDailyHabits,
  getIndoorAirQualityHacks,
} from '../src/utils/habits.ts';

const BASE_PREFS: UserPreferences = {
  city: DEFAULT_SAMPLE_CITY,
  planningFor: 'family',
  commuteMethod: 'mixed',
  preferredScale: 'india',
  onboardingCompleted: true,
};

test('getAdaptiveDailyHabits returns 9 balanced Morning/Afternoon/Evening habits with why explanations', () => {
  const habits = getAdaptiveDailyHabits(null, BASE_PREFS);
  assert.equal(habits.length, 9);
  assert.equal(habits.filter((h) => h.period === 'morning').length, 3);
  assert.equal(habits.filter((h) => h.period === 'afternoon').length, 3);
  assert.equal(habits.filter((h) => h.period === 'evening').length, 3);
  assert.ok(habits.every((h) => h.why.trim().length > 15));
});

test('getAdaptiveDailyHabits adapts to high pollution and vulnerable profiles', () => {
  const highAqi = buildDemoAirQuality(DEFAULT_SAMPLE_CITY, 'india');
  highAqi.severityLevel = 5;

  const habits = getAdaptiveDailyHabits(highAqi, {
    ...BASE_PREFS,
    planningFor: 'young_children',
    commuteMethod: 'walk_cycle',
  });

  const exertion = habits.find((h) => h.id === 'afternoon-exertion');
  assert.equal(exertion?.title, 'Move strenuous outdoor exercise indoors');
  assert.match(exertion?.detail.toLowerCase() ?? '', /playground|indoors/);

  const filtration = habits.find((h) => h.id === 'evening-filtration');
  // Balanced ventilation guidance must still allow venting kitchens/bathrooms safely
  assert.match(filtration?.detail.toLowerCase() ?? '', /vent|exhaust|fresh air/);
});

test('getIndoorAirQualityHacks includes air purifier, indoor plants, source control, and smart ventilation with why explanations', () => {
  const elevatedAqi = buildDemoAirQuality(DEFAULT_SAMPLE_CITY, 'india');
  elevatedAqi.severityLevel = 4;

  const hacks = getIndoorAirQualityHacks(elevatedAqi);
  assert.equal(hacks.length, 4);
  assert.ok(hacks.some((h) => /purifier|hepa/i.test(h.title + h.action)));
  assert.ok(hacks.some((h) => /plant/i.test(h.title + h.action)));
  assert.ok(hacks.every((h) => h.why.trim().length > 15));
});
