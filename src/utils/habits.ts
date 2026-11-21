import type {
  AirQualityData,
  DailyHabit,
  IndoorAirHack,
  UserPreferences,
} from '../shared/types.ts';

export function getAdaptiveDailyHabits(
  aqiData: AirQualityData | null,
  prefs: UserPreferences,
): DailyHabit[] {
  const severity = aqiData?.severityLevel ?? 2;
  const isElevated = severity >= 3;
  const isHigh = severity >= 4;
  const isChild = prefs.planningFor === 'young_children';
  const isSenior = prefs.planningFor === 'senior_citizens';
  const isSensitive = prefs.planningFor === 'sensitive';
  const isPro = prefs.planningFor === 'working_professional';
  const needsExtraCare = isChild || isSenior || isSensitive;

  return [
    // Morning
    {
      id: 'morning-check-aqi',
      period: 'morning',
      title: 'Check today’s air quality before heading out',
      detail: aqiData
        ? `${aqiData.city.name} is currently ${aqiData.categoryLabel} (${aqiData.aqi} ${aqiData.scale === 'india' ? 'India NAQI' : 'US AQI'}). Use the hourly outlook to pick cleaner hours.`
        : 'Look at today’s local AQI before deciding when to open windows or head outdoors.',
      why: 'Morning traffic and cool-air inversions often trap fine particles near ground level; checking AQI prevents accidental peak exposure.',
      category: 'cleaner_air',
    },
    {
      id: 'morning-commute',
      period: 'morning',
      title: 'Plan a lower-exposure, lower-emission commute',
      detail:
        prefs.commuteMethod === 'walk_cycle'
          ? isElevated
            ? 'Pick shaded side streets away from heavy traffic exhaust for your morning walk or ride.'
            : 'Take quieter neighborhood paths on your walk or bike ride.'
          : isPro || prefs.commuteMethod === 'private_vehicle'
            ? 'Combine errands into one trip, carpool, or switch to metro/bus during peak congestion.'
            : isElevated
              ? 'Travel slightly earlier or later than peak traffic when practical to reduce roadside exhaust exposure.'
              : 'Choose public transit, walking, or shared rides to keep neighborhood air cleaner.',
      why: 'Combining trips and choosing shared or non-motorized transit cuts tailpipe NO₂ and PM2.5 while reducing direct roadside inhalation.',
      category: 'sustainable',
    },
    {
      id: 'morning-idling',
      period: 'morning',
      title: 'Avoid unnecessary vehicle idling',
      detail:
        'Switch off the engine when waiting at traffic lights, school gates, or pickups for more than 30 seconds.',
      why: 'Idling burns fuel at zero miles while concentrating exhaust fumes right at breathing height for pedestrians and children.',
      category: 'sustainable',
    },

    // Afternoon
    {
      id: 'afternoon-exertion',
      period: 'afternoon',
      title: isHigh
        ? 'Move strenuous outdoor exercise indoors'
        : isChild
          ? 'Time outdoor play during cleaner midday hours'
          : 'Pace outdoor exertion around prevailing AQI',
      detail: isChild
        ? isElevated
          ? 'Keep active playground games indoors today, or choose short, gentle outdoor breaks in leafy parks away from roads.'
          : 'Midday sunlight often disperses morning haze—favor grassy parks away from main traffic.'
        : isSenior
          ? 'Take gentle walks at a comfortable pace and rest indoors if you notice throat dryness or shortness of breath.'
          : needsExtraCare || isElevated
            ? 'Keep intense workouts indoors or wait for cleaner hours instead of exercising near busy roads.'
            : 'Enjoy outdoor movement while air is cleaner, keeping water handy and avoiding smoky roadside spots.',
      why: 'Vigorous movement increases breathing volume several-fold, drawing more PM2.5 deep into the lungs when AQI is elevated.',
      category: 'cleaner_air',
    },
    {
      id: 'afternoon-smoke',
      period: 'afternoon',
      title: 'Avoid indoor smoke and unnecessary combustion sources',
      detail:
        'Skip incense sticks, scented candles, or indoor smoking, and use a kitchen exhaust fan or cracked window while cooking.',
      why: 'Cooking smoke and incense spike indoor PM2.5 and ultrafine particles far above outdoor levels unless vented promptly.',
      category: 'cleaner_air',
    },
    {
      id: 'afternoon-transit',
      period: 'afternoon',
      title: 'Choose public transport or carpooling for errands',
      detail:
        'Use metro, bus, carpooling, or walking for afternoon errands instead of making separate solo car or scooter trips.',
      why: 'Shared rides reduce per-person carbon emissions and cut street-level traffic dust across your neighborhood.',
      category: 'sustainable',
    },

    // Evening
    {
      id: 'evening-damp-clean',
      period: 'evening',
      title: 'Reduce indoor dust using damp cleaning methods',
      detail:
        'Wipe surfaces and mop floors with a damp cloth instead of dry sweeping or feather dusting.',
      why: 'Dry brooms kick settled PM10 and allergens back into the air you breathe, whereas damp wiping traps particles cleanly.',
      category: 'cleaner_air',
    },
    {
      id: 'evening-filtration',
      period: 'evening',
      title: 'Improve indoor filtration and balanced ventilation',
      detail: isHigh
        ? 'Run a HEPA air purifier on medium/auto, keep roadside windows closed during evening haze, and vent kitchens/bathrooms briefly when needed.'
        : 'Open windows briefly during calmer air for fresh cross-ventilation, or run a clean HEPA filter fan if dust builds up.',
      why: 'Balanced ventilation clears indoor CO₂ and humidity while HEPA filtration captures fine outdoor PM2.5 that drifts inside.',
      category: 'cleaner_air',
    },
    {
      id: 'evening-review',
      period: 'evening',
      title: 'Review today’s sustainable choices',
      detail:
        'Log any low-emission trips or clean-air habits in My Impact to see how your small daily routines add up.',
      why: 'Tracking avoided CO₂e and clean-air routines reinforces lasting habits that protect both household lungs and urban air.',
      category: 'sustainable',
    },
  ];
}

export function getIndoorAirQualityHacks(
  aqiData: AirQualityData | null,
): IndoorAirHack[] {
  const isElevated = (aqiData?.severityLevel ?? 2) >= 3;

  return [
    {
      id: 'hack-purifier',
      category: 'Air purifier',
      title: 'Optimize HEPA purifier placement & fan speed',
      action: isElevated
        ? 'Place your purifier in the room where you sleep or spend the most hours, keep 20–30 cm clearance around vents, and run it continuously on medium or auto rather than brief bursts.'
        : 'Keep purifier pre-filters vacuumed weekly so airflow stays strong, and run it in bedrooms at night during dusty or high-traffic evenings.',
      why: 'Continuous medium-speed circulation turns over room air multiple times per hour, steadily trapping PM2.5 without excessive fan noise.',
    },
    {
      id: 'hack-plants',
      category: 'Indoor plants',
      title: 'Pair air-purifying houseplants with filtration',
      action:
        'Keep low-maintenance plants like Areca palm, Snake plant, Peace lily, or Spider plant near sunlit corners, wiping dust off their leaves weekly (avoid overwatering to prevent mold).',
      why: 'Healthy indoor foliage adds natural humidity, absorbs trace gaseous VOCs, and keeps indoor dust from settling—working best alongside HEPA filtration for fine PM2.5.',
    },
    {
      id: 'hack-combustion',
      category: 'Source control',
      title: 'Eliminate hidden indoor smoke & fumes',
      action:
        'Run the kitchen chimney or exhaust fan 5 minutes before and after frying, cover pans while simmering, and swap burning incense or mosquito coils for electric or non-smoke alternatives.',
      why: 'Stopping pollutants at the source is faster and far cheaper than trying to filter lingering smoke after it spreads room-to-room.',
    },
    {
      id: 'hack-ventilation',
      category: 'Smart ventilation',
      title: 'Time cross-ventilation & trap entry dust',
      action: isElevated
        ? 'Keep traffic-facing windows closed during morning and evening rush hours; open windows briefly during the cleanest afternoon slot and place washable mats at doorways.'
        : 'Open opposite windows for 15–20 minutes during cleaner midday air to flush stale indoor CO₂, and leave outdoor shoes at the entrance.',
      why: 'Timed cross-ventilation refreshes oxygen and dilutes indoor pollutants without inviting peak rush-hour exhaust inside.',
    },
  ];
}
