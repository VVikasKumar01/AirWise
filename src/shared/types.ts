export type AqiScale = 'india' | 'us';

export type SeverityLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface CityLocation {
  id: string;
  name: string;
  region?: string;
  country: string;
  latitude: number;
  longitude: number;
  isSample?: boolean;
}

export interface PollutantReadings {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  co: number | null;
}

export interface HourlyAqiPoint {
  timeLabel: string;
  isoTime: string;
  aqi: number;
  severityLevel: SeverityLevel;
}

export interface AirQualityData {
  city: CityLocation;
  scale: AqiScale;
  aqi: number;
  categoryLabel: string;
  severityLevel: SeverityLevel;
  explanation: string;
  dominantPollutant: string | null;
  pollutants: PollutantReadings;
  hourly?: HourlyAqiPoint[];
  measuredAt: string;
  fetchedAt: string;
  isStale: boolean;
  isDemo: boolean;
  dataSource: string;
  notice?: string;
}

export type PlanningGroup =
  | 'just_me'
  | 'working_professional'
  | 'family'
  | 'young_children'
  | 'senior_citizens'
  | 'sensitive';

export type CommuteMethod =
  | 'walk_cycle'
  | 'public_transport'
  | 'private_vehicle'
  | 'mixed';

export interface UserPreferences {
  city: CityLocation;
  planningFor: PlanningGroup;
  commuteMethod: CommuteMethod;
  preferredScale: AqiScale;
  onboardingCompleted: boolean;
}

export interface AdviceRecommendations {
  outdoor: string;
  outdoorWhy: string;
  indoor: string;
  indoorWhy: string;
  travel: string;
  travelWhy: string;
  summary: string;
  source: 'gemini' | 'deterministic';
  notice?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  error?: boolean;
}

export type HabitPeriod = 'morning' | 'afternoon' | 'evening';

export interface DailyHabit {
  id: string;
  period: HabitPeriod;
  title: string;
  detail: string;
  why: string;
  category: 'cleaner_air' | 'sustainable';
}

export interface IndoorAirHack {
  id: string;
  category: string;
  title: string;
  action: string;
  why: string;
}

export interface EmissionFactors {
  privateCarGPerKm: number;
  twoWheelerGPerKm: number;
  publicTransitGPerKm: number;
  carpoolGPerKm: number;
  walkCycleGPerKm: number;
}

export interface ImpactAction {
  id: string;
  description: string;
  type: 'trip' | 'habit' | 'action';
  co2AvoidedKg: number;
  distanceKm?: number;
  replacedMode?: string;
  chosenMode?: string;
  timestamp: string;
}
