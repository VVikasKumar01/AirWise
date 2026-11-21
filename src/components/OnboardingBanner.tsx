import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { COMMUTE_OPTIONS, PLANNING_OPTIONS } from '../shared/constants.ts';
import type {
  CommuteMethod,
  PlanningGroup,
  UserPreferences,
} from '../shared/types.ts';

interface OnboardingBannerProps {
  preferences: UserPreferences;
  onComplete: (next: UserPreferences) => void;
  onSkip: () => void;
  onOpenLocationPicker: () => void;
}

export function OnboardingBanner({
  preferences,
  onComplete,
  onSkip,
  onOpenLocationPicker,
}: OnboardingBannerProps) {
  const [planningFor, setPlanningFor] = useState<PlanningGroup>(
    preferences.planningFor,
  );
  const [commuteMethod, setCommuteMethod] = useState<CommuteMethod>(
    preferences.commuteMethod,
  );

  return (
    <section
      aria-label="Quick personalization setup"
      className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E5E7EB]">
        <div>
          <h2 className="text-base font-semibold text-[#1F2937]">
            Tailor your daily air advice
          </h2>
          <p className="text-sm text-[#4B5563]">
            Three quick questions, saved only on this device.
          </p>
        </div>
        <button
          type="button"
          onClick={onSkip}
          className="self-start sm:self-auto min-h-[44px] px-3 text-sm font-medium text-[#4B5563] hover:text-[#1F2937] transition-colors whitespace-nowrap shrink-0"
        >
          Skip for now
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        <div>
          <div className="text-xs font-medium text-[#4B5563] mb-2">
            1. Which city do you live in?
          </div>
          <button
            type="button"
            onClick={onOpenLocationPicker}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] hover:bg-[#EEF6F2] flex items-center justify-between text-left transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-[#1F2937] truncate">
              <MapPin className="w-4 h-4 text-[#2E7D62] shrink-0" />
              <span className="truncate">{preferences.city.name}</span>
            </span>
            <span className="text-xs font-medium text-[#23634D] ml-2 shrink-0">
              Change
            </span>
          </button>
        </div>

        <div>
          <div className="text-xs font-medium text-[#4B5563] mb-2">
            2. Who are you planning for?
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Who are you planning for?">
            {PLANNING_OPTIONS.map((opt) => {
              const active = planningFor === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setPlanningFor(opt.value)}
                  className={`min-h-[44px] px-2.5 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                    active
                      ? 'bg-[#EEF6F2] border-[#2E7D62] text-[#1F2937] font-medium'
                      : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F8FAF9]'
                  }`}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-[#4B5563] mb-2">
            3. How do you usually travel?
          </div>
          <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="How do you usually travel?">
            {COMMUTE_OPTIONS.map((opt) => {
              const active = commuteMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCommuteMethod(opt.value)}
                  className={`min-h-[44px] px-2.5 py-1.5 rounded-lg border text-xs text-left transition-colors ${
                    active
                      ? 'bg-[#EEF6F2] border-[#2E7D62] text-[#1F2937] font-medium'
                      : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F8FAF9]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-[#E5E7EB] flex justify-end">
        <button
          type="button"
          onClick={() =>
            onComplete({
              ...preferences,
              planningFor,
              commuteMethod,
              onboardingCompleted: true,
            })
          }
          className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2E7D62] text-white text-sm font-medium hover:bg-[#24654F] transition-colors"
        >
          Save preferences
        </button>
      </div>
    </section>
  );
}
