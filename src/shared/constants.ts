import type { CommuteMethod, PlanningGroup } from './types.ts';

export const IMAGE_ASSETS = {
  HERO_SKY: '/src/assets/images/hero_sky_clouds_1795060780443.jpg',
  GUIDE_AVATAR: '/src/assets/images/guide_avatar_1795060779912.jpg',
  ICON_OUTDOOR: '/src/assets/images/icon_outdoor_1795060780772.jpg',
  ICON_INDOOR: '/src/assets/images/icon_indoor_1795060780816.jpg',
  ICON_TRAVEL: '/src/assets/images/icon_travel_1795060780315.jpg',
  ICON_ROUTINE: '/src/assets/images/icon_routine_1795060780000.jpg',
} as const;

export const PLANNING_OPTIONS: Array<{
  value: PlanningGroup;
  label: string;
  shortLabel: string;
}> = [
  { value: 'just_me', label: 'Just me', shortLabel: 'Just me' },
  {
    value: 'working_professional',
    label: 'Working professional (commute & office)',
    shortLabel: 'Professional',
  },
  { value: 'family', label: 'My family', shortLabel: 'My family' },
  {
    value: 'young_children',
    label: 'Young children playing outdoors',
    shortLabel: 'Young children',
  },
  {
    value: 'senior_citizens',
    label: 'Senior citizens',
    shortLabel: 'Senior citizens',
  },
  {
    value: 'sensitive',
    label: 'Someone sensitive to air pollution',
    shortLabel: 'Sensitive lungs',
  },
];

export function normalizePlanningGroup(raw: unknown): PlanningGroup {
  if (raw === 'children_elderly') return 'young_children';
  if (
    raw === 'just_me' ||
    raw === 'working_professional' ||
    raw === 'family' ||
    raw === 'young_children' ||
    raw === 'senior_citizens' ||
    raw === 'sensitive'
  ) {
    return raw;
  }
  return 'family';
}

export const COMMUTE_OPTIONS: Array<{ value: CommuteMethod; label: string }> = [
  { value: 'walk_cycle', label: 'Walking or cycling' },
  { value: 'public_transport', label: 'Public transport' },
  { value: 'private_vehicle', label: 'Private vehicle' },
  { value: 'mixed', label: 'Mixed transport' },
];

export const SUGGESTED_QUESTIONS: readonly string[] = [
  'Is it safe for kids to play outside right now?',
  'Which indoor air hacks and plants work best today?',
  'What is the lowest-emission commute option today?',
  'Why does today’s AQI level affect my health?',
];

export const LIMITS = {
  MAX_CHAT_MESSAGE_CHARS: 2000,
  MAX_CHAT_HISTORY_ITEMS: 12,
  MAX_RECENT_ACTIONS: 5,
  MAX_ACTION_TEXT_CHARS: 160,
  MAX_CITY_QUERY_CHARS: 100,
  MAX_CITY_NAME_CHARS: 100,
  MAX_TRIP_DISTANCE_KM: 2000,
} as const;
