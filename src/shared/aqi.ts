import type {
  AdviceRecommendations,
  AirQualityData,
  AqiScale,
  CityLocation,
  PollutantReadings,
  SeverityLevel,
  UserPreferences,
} from './types.ts';

export const DEFAULT_SAMPLE_CITY: CityLocation = {
  id: 'hyderabad-in',
  name: 'Hyderabad',
  region: 'Telangana',
  country: 'India',
  latitude: 17.385,
  longitude: 78.4867,
  isSample: true,
};

export const POPULAR_CITIES: CityLocation[] = [
  DEFAULT_SAMPLE_CITY,
  {
    id: 'delhi-in',
    name: 'New Delhi',
    region: 'Delhi',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.209,
  },
  {
    id: 'noida-in',
    name: 'Noida',
    region: 'Uttar Pradesh',
    country: 'India',
    latitude: 28.5355,
    longitude: 77.391,
  },
  {
    id: 'mumbai-in',
    name: 'Mumbai',
    region: 'Maharashtra',
    country: 'India',
    latitude: 19.076,
    longitude: 72.8777,
  },
  {
    id: 'kolkata-in',
    name: 'Kolkata',
    region: 'West Bengal',
    country: 'India',
    latitude: 22.5726,
    longitude: 88.3639,
  },
  {
    id: 'bengaluru-in',
    name: 'Bengaluru',
    region: 'Karnataka',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: 'chennai-in',
    name: 'Chennai',
    region: 'Tamil Nadu',
    country: 'India',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    id: 'pune-in',
    name: 'Pune',
    region: 'Maharashtra',
    country: 'India',
    latitude: 18.5204,
    longitude: 73.8567,
  },
  {
    id: 'london-gb',
    name: 'London',
    region: 'England',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    id: 'new-york-us',
    name: 'New York',
    region: 'New York',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.006,
  },
  {
    id: 'singapore-sg',
    name: 'Singapore',
    region: 'Central Singapore',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
  },
];

interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

// Official CPCB India National AQI breakpoints (continuous lower bounds prevent gap clamping)
const INDIA_PM25_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 30, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 60, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 90, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 120, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 250, cHigh: 500, iLow: 401, iHigh: 500 },
];

const INDIA_PM10_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 250, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 350, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 430, cHigh: 600, iLow: 401, iHigh: 500 },
];

const INDIA_NO2_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80, cHigh: 180, iLow: 101, iHigh: 200 },
  { cLow: 180, cHigh: 280, iLow: 201, iHigh: 300 },
  { cLow: 280, cHigh: 400, iLow: 301, iHigh: 400 },
  { cLow: 400, cHigh: 800, iLow: 401, iHigh: 500 },
];

const INDIA_O3_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 50, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 100, cHigh: 168, iLow: 101, iHigh: 200 },
  { cLow: 168, cHigh: 208, iLow: 201, iHigh: 300 },
  { cLow: 208, cHigh: 748, iLow: 301, iHigh: 400 },
  { cLow: 748, cHigh: 1000, iLow: 401, iHigh: 500 },
];

const INDIA_SO2_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 40, iLow: 0, iHigh: 50 },
  { cLow: 40, cHigh: 80, iLow: 51, iHigh: 100 },
  { cLow: 80, cHigh: 380, iLow: 101, iHigh: 200 },
  { cLow: 380, cHigh: 800, iLow: 201, iHigh: 300 },
  { cLow: 800, cHigh: 1600, iLow: 301, iHigh: 400 },
  { cLow: 1600, cHigh: 2400, iLow: 401, iHigh: 500 },
];

// Official CPCB India CO breakpoints in mg/m3 (Open-Meteo returns CO in ug/m3)
const INDIA_CO_MG_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 1.0, iLow: 0, iHigh: 50 },
  { cLow: 1.0, cHigh: 2.0, iLow: 51, iHigh: 100 },
  { cLow: 2.0, cHigh: 10.0, iLow: 101, iHigh: 200 },
  { cLow: 10.0, cHigh: 17.0, iLow: 201, iHigh: 300 },
  { cLow: 17.0, cHigh: 34.0, iLow: 301, iHigh: 400 },
  { cLow: 34.0, cHigh: 50.0, iLow: 401, iHigh: 500 },
];

// US EPA PM2.5 (2024 revision) and PM10 fallback breakpoints
const US_PM25_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.0, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.4, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.4, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.4, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.4, cHigh: 500.4, iLow: 301, iHigh: 500 },
];

const US_PM10_BP: Breakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 54, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 154, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 254, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 354, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 424, cHigh: 604, iLow: 301, iHigh: 500 },
];

function calcSubIndex(value: number | null, bps: Breakpoint[]): number | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  for (const bp of bps) {
    if (value <= bp.cHigh) {
      const span = bp.cHigh - bp.cLow;
      const ratio = span > 0 ? Math.max(0, value - bp.cLow) / span : 0;
      return Math.round(bp.iLow + ratio * (bp.iHigh - bp.iLow));
    }
  }
  return 500;
}

export function computeIndiaNaqi(pollutants: PollutantReadings): {
  aqi: number;
  dominantPollutant: string | null;
} {
  const coMg =
    pollutants.co !== null && Number.isFinite(pollutants.co)
      ? pollutants.co / 1000
      : null;

  const candidates: Array<{ name: string; sub: number | null }> = [
    { name: 'PM2.5', sub: calcSubIndex(pollutants.pm25, INDIA_PM25_BP) },
    { name: 'PM10', sub: calcSubIndex(pollutants.pm10, INDIA_PM10_BP) },
    { name: 'NO2', sub: calcSubIndex(pollutants.no2, INDIA_NO2_BP) },
    { name: 'O3', sub: calcSubIndex(pollutants.o3, INDIA_O3_BP) },
    { name: 'SO2', sub: calcSubIndex(pollutants.so2, INDIA_SO2_BP) },
    { name: 'CO', sub: calcSubIndex(coMg, INDIA_CO_MG_BP) },
  ];

  let maxSub = -1;
  let dominant: string | null = null;
  for (const item of candidates) {
    if (item.sub !== null && item.sub > maxSub) {
      maxSub = item.sub;
      dominant = item.name;
    }
  }

  return {
    aqi: maxSub >= 0 ? Math.min(500, maxSub) : 0,
    dominantPollutant: dominant,
  };
}

export function computeUsAqiFallback(pollutants: PollutantReadings): {
  aqi: number;
  dominantPollutant: string | null;
} {
  const candidates: Array<{ name: string; sub: number | null }> = [
    { name: 'PM2.5', sub: calcSubIndex(pollutants.pm25, US_PM25_BP) },
    { name: 'PM10', sub: calcSubIndex(pollutants.pm10, US_PM10_BP) },
  ];
  let maxSub = -1;
  let dominant: string | null = null;
  for (const item of candidates) {
    if (item.sub !== null && item.sub > maxSub) {
      maxSub = item.sub;
      dominant = item.name;
    }
  }
  return {
    aqi: maxSub >= 0 ? Math.min(500, maxSub) : 0,
    dominantPollutant: dominant,
  };
}

export function categorizeAqi(
  aqi: number,
  scale: AqiScale,
): {
  categoryLabel: string;
  severityLevel: SeverityLevel;
  explanation: string;
} {
  const rounded = Math.max(0, Math.round(Number.isFinite(aqi) ? aqi : 0));

  if (scale === 'india') {
    if (rounded <= 50) {
      return {
        categoryLabel: 'Good',
        severityLevel: 1,
        explanation:
          'Air quality is clean with minimal impact on everyday outdoor activities.',
      };
    }
    if (rounded <= 100) {
      return {
        categoryLabel: 'Satisfactory',
        severityLevel: 2,
        explanation:
          'Air quality is acceptable for most people, though very sensitive individuals may notice mild discomfort.',
      };
    }
    if (rounded <= 200) {
      return {
        categoryLabel: 'Moderate',
        severityLevel: 3,
        explanation:
          'Sensitive groups—including children, older adults, and people with breathing sensitivities—may feel mild irritation during extended outdoor exertion.',
      };
    }
    if (rounded <= 300) {
      return {
        categoryLabel: 'Poor',
        severityLevel: 4,
        explanation:
          'Breathing discomfort is possible for most people on prolonged exposure, and sensitive groups may feel effects sooner.',
      };
    }
    if (rounded <= 400) {
      return {
        categoryLabel: 'Very Poor',
        severityLevel: 5,
        explanation:
          'Air pollution is elevated enough to affect healthy adults during outdoor exertion and poses higher risk to sensitive groups.',
      };
    }
    return {
      categoryLabel: 'Severe',
      severityLevel: 6,
      explanation:
        'Air quality is severely polluted. Minimize outdoor exposure and prioritize clean indoor air.',
    };
  }

  // US EPA AQI scale
  if (rounded <= 50) {
    return {
      categoryLabel: 'Good',
      severityLevel: 1,
      explanation:
        'Air quality is clean and poses little or no risk for outdoor plans today.',
    };
  }
  if (rounded <= 100) {
    return {
      categoryLabel: 'Moderate',
      severityLevel: 2,
      explanation:
        'Air quality is acceptable overall, though unusually sensitive people may want to pace intense outdoor exercise.',
    };
  }
  if (rounded <= 150) {
    return {
      categoryLabel: 'Unhealthy for Sensitive Groups',
      severityLevel: 3,
      explanation:
        'Children, older adults, and people sensitive to air pollution should shorten prolonged or heavy outdoor exertion.',
    };
  }
  if (rounded <= 200) {
    return {
      categoryLabel: 'Unhealthy',
      severityLevel: 4,
      explanation:
        'Everyone may begin to experience irritation outdoors; moving strenuous exercise indoors is a safer choice.',
    };
  }
  if (rounded <= 300) {
    return {
      categoryLabel: 'Very Unhealthy',
      severityLevel: 5,
      explanation:
        'Health risk is elevated for everyone. Keep outdoor time brief and protect your indoor air quality.',
    };
  }
  return {
    categoryLabel: 'Hazardous',
    severityLevel: 6,
    explanation:
      'Emergency air quality conditions. Stay indoors with filtered air where possible and avoid outdoor exertion.',
  };
}

export function getSeverityStyle(level: SeverityLevel): {
  accentHex: string;
  bgTintClass: string;
  textClass: string;
  borderClass: string;
} {
  switch (level) {
    case 1:
      return {
        accentHex: '#23634D',
        bgTintClass: 'bg-[#EEF6F2]',
        textClass: 'text-[#23634D]',
        borderClass: 'border-[#CFE4DA]',
      };
    case 2:
      return {
        accentHex: '#2E6B47',
        bgTintClass: 'bg-[#F1F6EE]',
        textClass: 'text-[#28593B]',
        borderClass: 'border-[#D5E3CE]',
      };
    case 3:
      return {
        accentHex: '#925209',
        bgTintClass: 'bg-[#FEF7EC]',
        textClass: 'text-[#925209]',
        borderClass: 'border-[#F5DFB8]',
      };
    case 4:
      return {
        accentHex: '#9A3412',
        bgTintClass: 'bg-[#FFF3ED]',
        textClass: 'text-[#9A3412]',
        borderClass: 'border-[#F7CDB9]',
      };
    case 5:
      return {
        accentHex: '#991B1B',
        bgTintClass: 'bg-[#FEF2F2]',
        textClass: 'text-[#991B1B]',
        borderClass: 'border-[#F6C8C8]',
      };
    case 6:
      return {
        accentHex: '#6B21A8',
        bgTintClass: 'bg-[#FAF5FF]',
        textClass: 'text-[#6B21A8]',
        borderClass: 'border-[#E9D5FF]',
      };
  }
}

function getOutdoorBaseline(
  severityLevel: SeverityLevel,
  planningFor: UserPreferences['planningFor'],
  pollutantNote: string,
): { outdoor: string; outdoorWhy: string } {
  if (severityLevel <= 2) {
    switch (planningFor) {
      case 'young_children':
        return {
          outdoor:
            'Good window for outdoor playground time and sports; keep water handy and stick to grassy parks away from road traffic.',
          outdoorWhy:
            'Developing lungs breathe faster per kilogram of body weight, so low AQI parks keep fine-particle inhalation low.',
        };
      case 'senior_citizens':
        return {
          outdoor:
            'Comfortable conditions for a morning or evening walk at an easy pace in shaded neighborhood spaces.',
          outdoorWhy:
            'Cleaner air reduces airway irritation and cardiovascular strain during light outdoor movement.',
        };
      case 'sensitive':
        return {
          outdoor:
            'Normal outdoor walks and gentle activity are fine today while watching for any personal airway discomfort.',
          outdoorWhy:
            'Current pollution is below stress thresholds for most people, though pacing helps sensitive airways stay calm.',
        };
      case 'working_professional':
        return {
          outdoor:
            'Favorable conditions for a midday stretch walk or outdoor lunch break away from main intersections.',
          outdoorWhy:
            'Brief daylight movement boosts focus while low ambient pollution keeps exposure minimal.',
        };
      default:
        return {
          outdoor:
            'Conditions are favorable for outdoor walks, family play, and exercise today.',
          outdoorWhy:
            'Ambient pollutant levels are low enough that outdoor activity brings full physical benefits without heavy exposure.',
        };
    }
  }

  if (severityLevel === 3) {
    switch (planningFor) {
      case 'young_children':
        return {
          outdoor:
            'Keep outdoor play shorter today and shift energetic running or sports indoors or to quieter, tree-lined parks.',
          outdoorWhy: `Children inhale more ${pollutantNote} when breathing rapidly during active play, irritating developing airways.`,
        };
      case 'senior_citizens':
        return {
          outdoor:
            'Take shorter, gentle walks away from busy roads and rest indoors if you notice throat tightness or fatigue.',
          outdoorWhy: `Moderate ${pollutantNote} can trigger mild airway inflammation and extra heart-lung effort in older adults.`,
        };
      case 'sensitive':
        return {
          outdoor:
            'Limit prolonged outdoor exertion today, carry prescribed reliever inhalers if used, and avoid smoky roadside areas.',
          outdoorWhy: `Even moderate levels of ${pollutantNote} can irritate sensitive bronchial passages during deeper breathing.`,
        };
      case 'working_professional':
        return {
          outdoor:
            'Keep outdoor workouts light or move intense gym sessions indoors after work until traffic haze clears.',
          outdoorWhy: `Heavy breathing during rush-hour exertion draws ${pollutantNote} deeper into the lungs.`,
        };
      case 'family':
        return {
          outdoor:
            'Light outdoor errands are fine, but shift intense workouts or long playtimes indoors or to quieter streets.',
          outdoorWhy: `Lower breathing rates cut the total dose of ${pollutantNote} inhaled by kids and adults alike.`,
        };
      default:
        return {
          outdoor:
            'Light outdoor activity is fine, though scaling back long, intense workouts helps reduce exposure.',
          outdoorWhy: `Slower breathing during lighter movement limits how deeply ${pollutantNote} settles in your airways.`,
        };
    }
  }

  if (severityLevel === 4) {
    if (planningFor === 'young_children') {
      return {
        outdoor:
          'Move children’s games and sports indoors today and keep outdoor school or errand transitions brief.',
        outdoorWhy: `Elevated ${pollutantNote} quickly inflames children’s narrower airways when they run and breathe deeply.`,
      };
    }
    if (planningFor === 'senior_citizens') {
      return {
        outdoor:
          'Stay indoors during peak haze and postpone long walks; use a well-fitted N95 mask for essential errands.',
        outdoorWhy: `High ${pollutantNote} enters the bloodstream via the lungs, increasing respiratory and blood-pressure stress.`,
      };
    }
    return {
      outdoor:
        'Outdoor pollution is elevated. Move vigorous exercise indoors and keep outdoor trips brief when practical.',
      outdoorWhy: `High concentrations of ${pollutantNote} cause airway irritation for healthy adults during prolonged outdoor exposure.`,
    };
  }

  return {
    outdoor:
      'Air quality is very poor. Stay indoors as much as possible, cancel outdoor exercise, and wear a well-fitted N95/KN95 mask if going out.',
    outdoorWhy: `Severe ${pollutantNote} levels penetrate deep lung tissue; N95 filtration and indoor shelter sharply reduce particle inhalation.`,
  };
}

function getIndoorBaseline(severityLevel: SeverityLevel): {
  indoor: string;
  indoorWhy: string;
} {
  if (severityLevel <= 2) {
    return {
      indoor:
        'Open windows for cross-ventilation during calmer midday hours, use kitchen exhaust fans while cooking, and keep low-maintenance indoor plants like snake plant or areca palm.',
      indoorWhy:
        'Fresh outdoor air dilutes indoor CO₂ and cooking fumes, while damp dusting and greenery keep living spaces comfortable.',
    };
  }
  if (severityLevel === 3) {
    return {
      indoor:
        'Run a HEPA air purifier in main rooms if available, skip incense or candles, and crack a window with the kitchen exhaust fan on while cooking.',
      indoorWhy:
        'HEPA filters capture fine PM2.5 particles without sealing in cooking smoke or indoor gases.',
    };
  }
  return {
    indoor:
      'Keep roadside windows shut during peak haze, run a HEPA purifier on medium/auto, damp-mop floors instead of dry sweeping, and vent briefly with exhaust fans while cooking.',
    indoorWhy:
      'Damp cleaning traps settled dust without re-aerosolizing it, while HEPA filtration removes outdoor PM2.5 that seeps indoors.',
  };
}

function getTravelBaseline(
  severityLevel: SeverityLevel,
  commuteMethod: UserPreferences['commuteMethod'],
): { travel: string; travelWhy: string } {
  const isElevated = severityLevel >= 3;
  switch (commuteMethod) {
    case 'walk_cycle':
      return {
        travel: isElevated
          ? 'Choose quieter side streets or park paths away from main road exhaust, or switch to metro/bus for longer stretches today.'
          : 'Walking and cycling are zero-emission choices today—stick to greener neighborhood streets away from heavy traffic.',
        travelWhy: isElevated
          ? 'Stepping one or two streets off main roads sharply reduces direct tailpipe NO₂ and soot inhalation.'
          : 'Active travel produces zero tailpipe pollution while giving you cleaner air away from busy intersections.',
      };
    case 'private_vehicle':
      return {
        travel:
          'Combine errands into one trip, turn off your engine at long signals, or take metro, bus, or carpool to cut neighborhood emissions.',
        travelWhy:
          'Avoiding cold starts, idling, and solo trips lowers both fuel cost and roadside NO₂/PM2.5 buildup.',
      };
    case 'public_transport':
      return {
        travel:
          severityLevel >= 4
            ? 'Public transit lowers street pollution—travel just outside peak rush hours if flexible and wait back from idling tailpipes.'
            : 'Using metro, buses, or trains keeps neighborhood emissions lower than solo driving—keep choosing shaded or quieter stops.',
        travelWhy:
          'Shared transit moves many commuters per vehicle, slashing per-person tailpipe emissions across the city.',
      };
    default:
      return {
        travel: isElevated
          ? 'Combine errands, pick lower-traffic routes, and choose metro, bus, or carpooling to cut both personal exposure and emissions.'
          : 'Walk or cycle for short neighborhood trips and use public transit or carpooling for longer journeys.',
        travelWhy:
          'Matching short zero-emission trips with shared transit reduces both your inhaled traffic dose and local air pollution.',
      };
  }
}

export function buildBaselineAdvice(
  aqiData: AirQualityData,
  prefs: Pick<UserPreferences, 'planningFor' | 'commuteMethod'>,
): Omit<AdviceRecommendations, 'source' | 'notice'> {
  const { severityLevel, dominantPollutant } = aqiData;
  const pollutantNote = dominantPollutant
    ? `elevated ${dominantPollutant}`
    : 'airborne particles';

  const { outdoor, outdoorWhy } = getOutdoorBaseline(
    severityLevel,
    prefs.planningFor,
    pollutantNote,
  );
  const { indoor, indoorWhy } = getIndoorBaseline(severityLevel);
  const { travel, travelWhy } = getTravelBaseline(
    severityLevel,
    prefs.commuteMethod,
  );
  const summary = `In ${aqiData.city.name}, the ${aqiData.scale === 'india' ? 'India National AQI' : 'US EPA AQI'} is ${aqiData.aqi} (${aqiData.categoryLabel}). ${aqiData.explanation}`;

  return {
    outdoor,
    outdoorWhy,
    indoor,
    indoorWhy,
    travel,
    travelWhy,
    summary,
  };
}

export function getPollutantStatus(
  pollutant: 'pm25' | 'pm10' | 'no2' | 'o3',
  value: number | null,
  scale: AqiScale = 'india',
): { label: string; colorClass: string; borderClass: string } {
  if (value === null || !Number.isFinite(value)) {
    return {
      label: '—',
      colorClass: 'text-[#4B5563]',
      borderClass: 'border-[#E5E7EB]',
    };
  }

  // Scale-aware concentration thresholds (ug/m3): CPCB India vs US EPA / WHO
  const thresholds: Record<'pm25' | 'pm10' | 'no2' | 'o3', [number, number]> =
    scale === 'us'
      ? {
          pm25: [9.0, 35.4],
          pm10: [54, 154],
          no2: [40, 100],
          o3: [100, 140],
        }
      : {
          pm25: [30, 60],
          pm10: [50, 100],
          no2: [40, 80],
          o3: [50, 100],
        };

  const [goodMax, modMax] = thresholds[pollutant];
  if (value <= goodMax) {
    return {
      label: 'Good',
      colorClass: 'text-[#23634D]',
      borderClass: 'border-[#CFE4DA]',
    };
  }
  if (value <= modMax) {
    return {
      label: 'Moderate',
      colorClass: 'text-[#925209]',
      borderClass: 'border-[#F5DFB8]',
    };
  }
  return {
    label: 'Elevated',
    colorClass: 'text-[#9A3412]',
    borderClass: 'border-[#F7CDB9]',
  };
}

export function calculateTripCo2AvoidedKg(
  distanceKm: number,
  replacedFactorGPerKm: number,
  chosenFactorGPerKm: number,
): number {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(replacedFactorGPerKm) ||
    !Number.isFinite(chosenFactorGPerKm) ||
    distanceKm <= 0
  ) {
    return 0;
  }
  const diffG = Math.max(0, replacedFactorGPerKm - chosenFactorGPerKm);
  return Math.round(((diffG * distanceKm) / 1000) * 100) / 100;
}

export function buildDemoAirQuality(
  city: CityLocation,
  scale: AqiScale,
  reason?: string,
): AirQualityData {
  // Deterministic sample readings by city so Demo Mode is consistent and clearly marked
  const seed = Math.abs(Math.round(city.latitude * 10 + city.longitude * 10)) % 4;
  const sampleProfiles: PollutantReadings[] = [
    { pm25: 54.2, pm10: 96.4, no2: 34.1, o3: 52.0, so2: 11.4, co: 720 },
    { pm25: 28.5, pm10: 52.0, no2: 24.0, o3: 44.5, so2: 8.1, co: 460 },
    { pm25: 76.0, pm10: 148.0, no2: 46.2, o3: 61.0, so2: 14.8, co: 910 },
    { pm25: 16.4, pm10: 31.2, no2: 18.6, o3: 48.2, so2: 6.4, co: 350 },
  ];
  const pollutants = sampleProfiles[seed];
  const computed =
    scale === 'india'
      ? computeIndiaNaqi(pollutants)
      : computeUsAqiFallback(pollutants);
  const categorized = categorizeAqi(computed.aqi, scale);

  const now = new Date();
  const sampleOffsets = [0, 2, 4, 6];
  const hourly = sampleOffsets.map((offset, idx) => {
    const t = new Date(now.getTime() + offset * 3600 * 1000);
    const delta = idx === 0 ? 0 : idx === 1 ? -6 : idx === 2 ? 12 : 4;
    const val = Math.max(12, Math.min(450, computed.aqi + delta));
    const cat = categorizeAqi(val, scale);
    return {
      timeLabel:
        idx === 0
          ? 'Now'
          : `${String(t.getHours()).padStart(2, '0')}:00`,
      isoTime: t.toISOString(),
      aqi: val,
      severityLevel: cat.severityLevel,
    };
  });

  return {
    city,
    scale,
    aqi: computed.aqi,
    categoryLabel: categorized.categoryLabel,
    severityLevel: categorized.severityLevel,
    explanation: categorized.explanation,
    dominantPollutant: computed.dominantPollutant,
    pollutants,
    hourly,
    measuredAt: now.toISOString(),
    fetchedAt: now.toISOString(),
    isStale: false,
    isDemo: true,
    dataSource: 'Demo Mode (Sample Data)',
    notice:
      reason ||
      'Showing clearly labeled sample data. Live station measurements are currently unavailable or Demo Mode is enabled.',
  };
}
