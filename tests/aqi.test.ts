import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBaselineAdvice,
  buildDemoAirQuality,
  calculateTripCo2AvoidedKg,
  categorizeAqi,
  computeIndiaNaqi,
  computeUsAqiFallback,
  DEFAULT_SAMPLE_CITY,
  getPollutantStatus,
} from '../src/shared/aqi.ts';
import type { PollutantReadings } from '../src/shared/types.ts';

const EMPTY_POLLUTANTS: PollutantReadings = {
  pm25: null,
  pm10: null,
  no2: null,
  o3: null,
  so2: null,
  co: null,
};

test('computeIndiaNaqi calculates sub-indices accurately including CO mg/m3 conversion', () => {
  const good = computeIndiaNaqi({
    ...EMPTY_POLLUTANTS,
    pm25: 15,
    pm10: 25,
  });
  assert.equal(good.aqi, 25);
  assert.equal(good.dominantPollutant, 'PM2.5');

  // Verify continuous breakpoint boundaries (no clamping gap between 30 and 30.1)
  const at30 = computeIndiaNaqi({ ...EMPTY_POLLUTANTS, pm25: 30 });
  const above30 = computeIndiaNaqi({ ...EMPTY_POLLUTANTS, pm25: 30.5 });
  assert.equal(at30.aqi, 50);
  assert.ok(above30.aqi >= 51);

  // CO 1500 ug/m3 = 1.5 mg/m3 -> ~76 in CPCB [1..2 -> 51..100]
  const coDominant = computeIndiaNaqi({
    ...EMPTY_POLLUTANTS,
    pm25: 10,
    co: 1500,
  });
  assert.equal(coDominant.dominantPollutant, 'CO');
  assert.equal(coDominant.aqi, 76);

  // Handles null and non-finite inputs safely
  const invalid = computeIndiaNaqi({
    ...EMPTY_POLLUTANTS,
    pm25: Number.NaN,
    pm10: -5,
  });
  assert.equal(invalid.aqi, 0);
  assert.equal(invalid.dominantPollutant, null);

  // Caps extreme values at 500
  const extreme = computeIndiaNaqi({ ...EMPTY_POLLUTANTS, pm25: 900 });
  assert.equal(extreme.aqi, 500);
});

test('computeUsAqiFallback follows US EPA 2024 PM2.5 thresholds', () => {
  const good = computeUsAqiFallback({ ...EMPTY_POLLUTANTS, pm25: 9.0 });
  assert.equal(good.aqi, 50);
  assert.equal(good.dominantPollutant, 'PM2.5');

  const usg = computeUsAqiFallback({ ...EMPTY_POLLUTANTS, pm25: 55.4 });
  assert.equal(usg.aqi, 150);
});

test('categorizeAqi maps both India NAQI and US EPA scales properly', () => {
  assert.equal(categorizeAqi(40, 'india').categoryLabel, 'Good');
  assert.equal(categorizeAqi(85, 'india').categoryLabel, 'Satisfactory');
  assert.equal(categorizeAqi(150, 'india').categoryLabel, 'Moderate');
  assert.equal(categorizeAqi(250, 'india').categoryLabel, 'Poor');
  assert.equal(categorizeAqi(350, 'india').categoryLabel, 'Very Poor');
  assert.equal(categorizeAqi(420, 'india').categoryLabel, 'Severe');

  assert.equal(categorizeAqi(40, 'us').categoryLabel, 'Good');
  assert.equal(categorizeAqi(85, 'us').categoryLabel, 'Moderate');
  assert.equal(
    categorizeAqi(125, 'us').categoryLabel,
    'Unhealthy for Sensitive Groups',
  );
  assert.equal(categorizeAqi(175, 'us').categoryLabel, 'Unhealthy');
  assert.equal(categorizeAqi(250, 'us').categoryLabel, 'Very Unhealthy');
  assert.equal(categorizeAqi(350, 'us').categoryLabel, 'Hazardous');
});

test('getPollutantStatus is scale-aware for India vs US thresholds', () => {
  const indiaPm25 = getPollutantStatus('pm25', 25, 'india');
  const usPm25 = getPollutantStatus('pm25', 25, 'us');
  assert.equal(indiaPm25.label, 'Good');
  assert.equal(usPm25.label, 'Moderate');

  assert.equal(getPollutantStatus('pm25', null, 'india').label, '—');
});

test('buildBaselineAdvice balances indoor ventilation, adapts to profiles, and includes explainable why fields', () => {
  const poorSample = buildDemoAirQuality(
    {
      id: 'delhi-in',
      name: 'New Delhi',
      country: 'India',
      latitude: 28.6139,
      longitude: 77.209,
    },
    'india',
  );
  poorSample.severityLevel = 5;

  const advice = buildBaselineAdvice(poorSample, {
    planningFor: 'young_children',
    commuteMethod: 'walk_cycle',
  });

  assert.match(advice.indoor.toLowerCase(), /exhaust|cooking|purifier/);
  assert.match(advice.outdoor.toLowerCase(), /indoors|mask/);
  assert.match(advice.travel.toLowerCase(), /side streets|metro|bus|public transit/);
  assert.ok(advice.outdoorWhy.length > 15);
  assert.ok(advice.indoorWhy.length > 15);
  assert.ok(advice.travelWhy.length > 15);

  const moderateSample = { ...poorSample, severityLevel: 3 as const };
  const seniorAdvice = buildBaselineAdvice(moderateSample, {
    planningFor: 'senior_citizens',
    commuteMethod: 'public_transport',
  });
  const proAdvice = buildBaselineAdvice(moderateSample, {
    planningFor: 'working_professional',
    commuteMethod: 'private_vehicle',
  });

  assert.notEqual(seniorAdvice.outdoor, proAdvice.outdoor);
  assert.match(proAdvice.travel.toLowerCase(), /combine errands|carpool/);
});

test('calculateTripCo2AvoidedKg computes positive avoided emissions and guards edge cases', () => {
  // 10 km: 171 g/km car replaced by 48 g/km transit => 1.23 kg
  assert.equal(calculateTripCo2AvoidedKg(10, 171, 48), 1.23);
  // Chosen factor higher than replaced never returns negative CO2 saved
  assert.equal(calculateTripCo2AvoidedKg(10, 84, 100), 0);
  assert.equal(calculateTripCo2AvoidedKg(-5, 171, 0), 0);
  assert.equal(calculateTripCo2AvoidedKg(Number.NaN, 171, 0), 0);
});

test('buildDemoAirQuality produces clearly marked demo data with 4 hourly slots', () => {
  const demo = buildDemoAirQuality(DEFAULT_SAMPLE_CITY, 'india');
  assert.equal(demo.isDemo, true);
  assert.equal(demo.hourly?.length, 4);
  assert.equal(demo.hourly?.[0].timeLabel, 'Now');
  assert.ok(demo.explanation.length > 10);
});
