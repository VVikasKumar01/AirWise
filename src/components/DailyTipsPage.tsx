import { useMemo } from 'react';
import { Check, Flower2, Wind } from 'lucide-react';
import type {
  AirQualityData,
  HabitPeriod,
  UserPreferences,
} from '../shared/types.ts';
import {
  getAdaptiveDailyHabits,
  getIndoorAirQualityHacks,
} from '../utils/habits.ts';

interface DailyTipsPageProps {
  aqiData: AirQualityData | null;
  preferences: UserPreferences;
  completedIds: string[];
  onToggleHabit: (habitId: string, title: string, willComplete: boolean) => void;
}

const PERIOD_LABELS: Array<{ key: HabitPeriod; label: string }> = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
];

export function DailyTipsPage({
  aqiData,
  preferences,
  completedIds,
  onToggleHabit,
}: DailyTipsPageProps) {
  const habits = useMemo(
    () => getAdaptiveDailyHabits(aqiData, preferences),
    [aqiData, preferences],
  );
  const indoorHacks = useMemo(
    () => getIndoorAirQualityHacks(aqiData),
    [aqiData],
  );

  const completedCount = habits.filter((h) => completedIds.includes(h.id)).length;
  const progressPercent = Math.round((completedCount / habits.length) * 100);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2937]">
          Your Cleaner Air Routine
        </h1>
        <p className="text-sm sm:text-base text-[#4B5563]">
          Low-emission daily habits and practical indoor air hacks adapted to{' '}
          {aqiData ? `${aqiData.city.name}’s current AQI` : 'your local air'}.
        </p>
      </div>

      {/* Single compact progress indicator */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            aria-live="polite"
            className="text-sm font-medium text-[#1F2937] tabular-nums"
          >
            {completedCount} of {habits.length} habits completed today
          </span>
          <span className="text-xs text-[#4B5563]">
            Resets automatically each day
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Daily cleaner air routine progress"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={habits.length}
          className="h-2 w-full bg-[#F3F4F6] rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[#2E7D62] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Morning, Afternoon, Evening groups */}
      <div className="space-y-6">
        {PERIOD_LABELS.map((group) => {
          const groupHabits = habits.filter((h) => h.period === group.key);
          return (
            <section key={group.key} className="space-y-3">
              <h2 className="text-base font-semibold text-[#1F2937]">
                {group.label}
              </h2>

              <div className="space-y-2.5">
                {groupHabits.map((habit) => {
                  const checked = completedIds.includes(habit.id);
                  return (
                    <button
                      key={habit.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() =>
                        onToggleHabit(habit.id, habit.title, !checked)
                      }
                      className={`w-full min-h-[60px] text-left rounded-2xl border px-4 py-3.5 flex items-start gap-3.5 transition-colors ${
                        checked
                          ? 'bg-[#EEF6F2] border-[#CFE4DA]'
                          : 'bg-white border-[#E5E7EB] hover:border-[#D1D5DB]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          checked
                            ? 'bg-[#2E7D62] border-[#2E7D62] text-white'
                            : 'bg-white border-[#D1D5DB]'
                        }`}
                      >
                        {checked && <Check className="w-4 h-4 stroke-[2.5]" />}
                      </span>

                      <span className="min-w-0 flex-1 space-y-1">
                        <span
                          className={`block text-sm sm:text-base font-medium ${
                            checked
                              ? 'text-[#23634D] line-through decoration-[#2E7D62]/50'
                              : 'text-[#1F2937]'
                          }`}
                        >
                          {habit.title}
                        </span>
                        <span className="block text-xs sm:text-sm text-[#4B5563] leading-relaxed">
                          {habit.detail}
                        </span>
                        <span className="block text-xs text-[#4B5563] leading-relaxed pt-1">
                          <strong className="font-semibold text-[#23634D]">
                            Why it helps:
                          </strong>{' '}
                          {habit.why}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Dedicated Indoor Air Quality Hacks Section */}
      <section aria-label="Indoor air quality hacks" className="space-y-4 pt-2 border-t border-[#E5E7EB]">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[#1F2937]">
            Indoor Air Quality Hacks
          </h2>
          <p className="text-xs sm:text-sm text-[#4B5563]">
            Practical ways to keep indoor rooms cleaner using purifiers, supportive plants, and source control.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {indoorHacks.map((hack) => (
            <article
              key={hack.id}
              className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#23634D]">
                  {hack.category}
                </span>
                {hack.id === 'hack-plants' ? (
                  <Flower2 className="w-4 h-4 text-[#2E7D62] shrink-0" aria-hidden="true" />
                ) : (
                  <Wind className="w-4 h-4 text-[#2E7D62] shrink-0" aria-hidden="true" />
                )}
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-[#1F2937]">
                {hack.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                {hack.action}
              </p>
              <p className="pt-2 border-t border-[#E5E7EB] text-xs text-[#4B5563] leading-relaxed">
                <strong className="font-semibold text-[#23634D]">
                  Why it helps:
                </strong>{' '}
                {hack.why}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
