import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap.ts';
import { COMMUTE_OPTIONS, PLANNING_OPTIONS } from '../shared/constants.ts';
import type {
  AqiScale,
  CommuteMethod,
  PlanningGroup,
  UserPreferences,
} from '../shared/types.ts';

interface PreferencesModalProps {
  open: boolean;
  preferences: UserPreferences;
  onClose: () => void;
  onSave: (next: UserPreferences) => void;
  onOpenLocationPicker: () => void;
}

export function PreferencesModal({
  open,
  preferences,
  onClose,
  onSave,
  onOpenLocationPicker,
}: PreferencesModalProps) {
  const [planningFor, setPlanningFor] = useState<PlanningGroup>(
    preferences.planningFor,
  );
  const [commuteMethod, setCommuteMethod] = useState<CommuteMethod>(
    preferences.commuteMethod,
  );
  const [preferredScale, setPreferredScale] = useState<AqiScale>(
    preferences.preferredScale,
  );

  const modalRef = useModalFocusTrap(open, onClose);

  useEffect(() => {
    if (open) {
      setPlanningFor(preferences.planningFor);
      setCommuteMethod(preferences.commuteMethod);
      setPreferredScale(preferences.preferredScale);
    }
  }, [open, preferences]);

  if (!open) return null;

  const handleSave = () => {
    onSave({
      ...preferences,
      planningFor,
      commuteMethod,
      preferredScale,
      onboardingCompleted: true,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preferences-modal-title"
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-[#E5E7EB] shadow-lg overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
          <div>
            <h2
              id="preferences-modal-title"
              className="text-lg font-semibold text-[#1F2937]"
            >
              Personalize AirWise
            </h2>
            <p className="text-xs text-[#4B5563] mt-0.5">
              Saved locally on your device — no account needed
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preferences"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] hover:text-[#1F2937] hover:bg-[#F8FAF9] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          <div>
            <div className="block text-sm font-medium text-[#1F2937] mb-2">
              1. Which city do you live in?
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLocationPicker();
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] hover:bg-[#EEF6F2] flex items-center justify-between text-left transition-colors"
            >
              <span className="flex items-center gap-2.5 text-sm font-medium text-[#1F2937]">
                <MapPin className="w-4 h-4 text-[#2E7D62]" />
                <span>
                  {preferences.city.name}, {preferences.city.country}
                </span>
              </span>
              <span className="text-xs font-medium text-[#23634D]">Change</span>
            </button>
          </div>

          <div>
            <div className="block text-sm font-medium text-[#1F2937] mb-2">
              2. Who are you planning for?
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Who are you planning for?">
              {PLANNING_OPTIONS.map((opt) => {
                const active = planningFor === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPlanningFor(opt.value)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-sm transition-colors ${
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

          <div>
            <div className="block text-sm font-medium text-[#1F2937] mb-2">
              3. How do you usually travel?
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="How do you usually travel?">
              {COMMUTE_OPTIONS.map((opt) => {
                const active = commuteMethod === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCommuteMethod(opt.value)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-sm transition-colors ${
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

          <div>
            <div className="block text-sm font-medium text-[#1F2937] mb-2">
              Preferred AQI scale
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F8FAF9] border border-[#E5E7EB]" role="group" aria-label="Preferred AQI scale">
              <button
                type="button"
                aria-pressed={preferredScale === 'india'}
                onClick={() => setPreferredScale('india')}
                className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  preferredScale === 'india'
                    ? 'bg-white text-[#1F2937] shadow-xs border border-[#E5E7EB]'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                India National AQI
              </button>
              <button
                type="button"
                aria-pressed={preferredScale === 'us'}
                onClick={() => setPreferredScale('us')}
                className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors ${
                  preferredScale === 'us'
                    ? 'bg-white text-[#1F2937] shadow-xs border border-[#E5E7EB]'
                    : 'text-[#4B5563] hover:text-[#1F2937]'
                }`}
              >
                US EPA AQI
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E5E7EB] bg-[#F8FAF9] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium text-[#4B5563] hover:text-[#1F2937] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] px-5 py-2 rounded-xl text-sm font-medium bg-[#2E7D62] text-white hover:bg-[#24654F] transition-colors"
          >
            Save preferences
          </button>
        </div>
      </div>
    </div>
  );
}
