import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Leaf,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { calculateTripCo2AvoidedKg } from '../shared/aqi.ts';
import { LIMITS } from '../shared/constants.ts';
import type { EmissionFactors, ImpactAction } from '../shared/types.ts';
import { DEFAULT_EMISSION_FACTORS } from '../utils/storage.ts';

interface ImpactPageProps {
  actions: ImpactAction[];
  emissionFactors: EmissionFactors;
  onAddAction: (action: ImpactAction) => void;
  onRemoveAction: (id: string) => void;
  onUpdateFactors: (factors: EmissionFactors) => void;
}

type ReplacedMode = 'privateCar' | 'twoWheeler';
type ChosenMode = 'walkCycle' | 'publicTransit' | 'carpool';

const QUICK_ACTIONS = [
  'Used public transport instead of driving alone.',
  'Skipped burning incense indoors.',
  'Moved outdoor exercise indoors during poor air quality.',
  'Turned off vehicle engine instead of idling.',
];

const FACTOR_FIELDS: Array<{
  key: keyof Pick<
    EmissionFactors,
    'privateCarGPerKm' | 'twoWheelerGPerKm' | 'publicTransitGPerKm' | 'carpoolGPerKm'
  >;
  label: string;
}> = [
  { key: 'privateCarGPerKm', label: 'Private car (g/km)' },
  { key: 'twoWheelerGPerKm', label: 'Two-wheeler (g/km)' },
  { key: 'publicTransitGPerKm', label: 'Public transit (g/km)' },
  { key: 'carpoolGPerKm', label: 'Carpool (g/km)' },
];

function createActionId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatActionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Today';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ImpactPage({
  actions,
  emissionFactors,
  onAddAction,
  onRemoveAction,
  onUpdateFactors,
}: ImpactPageProps) {
  const [entryTab, setEntryTab] = useState<'trip' | 'action'>('trip');
  const [distanceKm, setDistanceKm] = useState('');
  const [distanceTouched, setDistanceTouched] = useState(false);
  const [replacedMode, setReplacedMode] = useState<ReplacedMode>('privateCar');
  const [chosenMode, setChosenMode] = useState<ChosenMode>('publicTransit');
  const [customAction, setCustomAction] = useState('');
  const [showAssumptions, setShowAssumptions] = useState(false);

  const trimmedDist = distanceKm.trim();
  const parsedDistance = Number(trimmedDist);
  const validDistance =
    trimmedDist !== '' &&
    Number.isFinite(parsedDistance) &&
    parsedDistance > 0 &&
    parsedDistance <= LIMITS.MAX_TRIP_DISTANCE_KM;

  const showDistanceError =
    (distanceTouched || trimmedDist !== '') &&
    trimmedDist !== '' &&
    !validDistance;

  const replacedFactorG =
    replacedMode === 'privateCar'
      ? emissionFactors.privateCarGPerKm
      : emissionFactors.twoWheelerGPerKm;

  const chosenFactorG =
    chosenMode === 'walkCycle'
      ? emissionFactors.walkCycleGPerKm
      : chosenMode === 'publicTransit'
        ? emissionFactors.publicTransitGPerKm
        : emissionFactors.carpoolGPerKm;

  const estimatedSavingsKg = validDistance
    ? calculateTripCo2AvoidedKg(parsedDistance, replacedFactorG, chosenFactorG)
    : 0;

  const chosenFactorNotLower = chosenFactorG >= replacedFactorG;

  const totalSustainableActions = actions.filter(
    (a) => a.type === 'trip' || a.type === 'action',
  ).length;

  const totalHabitsLogged = actions.filter((a) => a.type === 'habit').length;

  const totalCo2AvoidedKg = actions.reduce(
    (sum, item) => sum + (item.co2AvoidedKg || 0),
    0,
  );

  const handleLogTrip = (e: React.FormEvent) => {
    e.preventDefault();
    setDistanceTouched(true);
    if (!validDistance) return;

    const chosenLabel =
      chosenMode === 'walkCycle'
        ? 'walked or cycled'
        : chosenMode === 'publicTransit'
          ? 'used public transport'
          : 'carpooled';
    const replacedLabel =
      replacedMode === 'privateCar' ? 'driving alone' : 'riding a two-wheeler';

    onAddAction({
      id: createActionId('trip'),
      description: `Travelled ${parsedDistance} km: ${chosenLabel} instead of ${replacedLabel}.`,
      type: 'trip',
      co2AvoidedKg: estimatedSavingsKg,
      distanceKm: parsedDistance,
      replacedMode: replacedLabel,
      chosenMode: chosenLabel,
      timestamp: new Date().toISOString(),
    });
    setDistanceKm('');
    setDistanceTouched(false);
  };

  const handleLogQuickAction = (description: string) => {
    const trimmed = description.trim().slice(0, LIMITS.MAX_ACTION_TEXT_CHARS);
    if (!trimmed) return;
    onAddAction({
      id: createActionId('act'),
      description: trimmed,
      type: 'action',
      co2AvoidedKg: 0,
      timestamp: new Date().toISOString(),
    });
    setCustomAction('');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2937]">
          My Positive Impact
        </h1>
        <p className="text-sm sm:text-base text-[#4B5563]">
          See how small changes add up.
        </p>
      </div>

      {/* 3 Compact Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
          <div className="text-xs font-medium text-[#4B5563]">
            Sustainable actions completed
          </div>
          <div className="mt-2 text-3xl font-bold text-[#1F2937] tabular-nums">
            {totalSustainableActions}
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
          <div className="text-xs font-medium text-[#4B5563]">
            Estimated CO2e emissions avoided
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold text-[#23634D] tabular-nums">
              {totalCo2AvoidedKg.toFixed(1)}
            </span>
            <span className="text-sm font-medium text-[#4B5563]">kg CO2e</span>
          </div>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
          <div className="text-xs font-medium text-[#4B5563]">
            Cleaner-air habits completed
          </div>
          <div className="mt-2 text-3xl font-bold text-[#1F2937] tabular-nums">
            {totalHabitsLogged}
          </div>
        </div>
      </div>

      {/* Interactive Trip CO2e Estimator & Quick Action Logger */}
      <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#1F2937]">
              Log a positive choice
            </h2>
            <p className="text-xs sm:text-sm text-[#4B5563]">
              Enter trip details to estimate CO2e avoided, or record a clean-air
              step.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Entry type"
            className="flex items-center p-1 rounded-xl bg-[#F8FAF9] border border-[#E5E7EB] self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={entryTab === 'trip'}
              onClick={() => setEntryTab('trip')}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                entryTab === 'trip'
                  ? 'bg-white text-[#1F2937] shadow-xs border border-[#E5E7EB]'
                  : 'text-[#4B5563] hover:text-[#1F2937]'
              }`}
            >
              Low-emission trip
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryTab === 'action'}
              onClick={() => setEntryTab('action')}
              className={`min-h-[44px] px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                entryTab === 'action'
                  ? 'bg-white text-[#1F2937] shadow-xs border border-[#E5E7EB]'
                  : 'text-[#4B5563] hover:text-[#1F2937]'
              }`}
            >
              Clean-air action
            </button>
          </div>
        </div>

        {entryTab === 'trip' ? (
          <form onSubmit={handleLogTrip} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="trip-distance"
                  className="block text-xs font-medium text-[#374151] mb-1.5"
                >
                  Approximate distance (km)
                </label>
                <input
                  id="trip-distance"
                  type="number"
                  min="0.1"
                  max={LIMITS.MAX_TRIP_DISTANCE_KM}
                  step="0.5"
                  value={distanceKm}
                  aria-invalid={showDistanceError}
                  aria-describedby={showDistanceError ? 'trip-distance-error' : undefined}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  onBlur={() => setDistanceTouched(true)}
                  placeholder="e.g. 8"
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] focus:bg-white focus:border-[#2E7D62] text-sm text-[#1F2937] tabular-nums focus:outline-none"
                />
                {showDistanceError && (
                  <p
                    id="trip-distance-error"
                    role="alert"
                    className="mt-1.5 text-xs text-[#9A3412]"
                  >
                    Enter a distance between 0.1 and {LIMITS.MAX_TRIP_DISTANCE_KM} km.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="replaced-mode"
                  className="block text-xs font-medium text-[#374151] mb-1.5"
                >
                  Instead of
                </label>
                <select
                  id="replaced-mode"
                  value={replacedMode}
                  onChange={(e) =>
                    setReplacedMode(e.target.value as ReplacedMode)
                  }
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] focus:bg-white focus:border-[#2E7D62] text-sm text-[#1F2937] focus:outline-none"
                >
                  <option value="privateCar">
                    Private car ({emissionFactors.privateCarGPerKm} g/km)
                  </option>
                  <option value="twoWheeler">
                    Two-wheeler ({emissionFactors.twoWheelerGPerKm} g/km)
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="chosen-mode"
                  className="block text-xs font-medium text-[#374151] mb-1.5"
                >
                  I chose
                </label>
                <select
                  id="chosen-mode"
                  value={chosenMode}
                  onChange={(e) => setChosenMode(e.target.value as ChosenMode)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] focus:bg-white focus:border-[#2E7D62] text-sm text-[#1F2937] focus:outline-none"
                >
                  <option value="publicTransit">
                    Public transport ({emissionFactors.publicTransitGPerKm} g/km)
                  </option>
                  <option value="walkCycle">
                    Walking or cycling ({emissionFactors.walkCycleGPerKm} g/km)
                  </option>
                  <option value="carpool">
                    Carpool / shared ride ({emissionFactors.carpoolGPerKm} g/km)
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[#4B5563] tabular-nums">
                {validDistance
                  ? chosenFactorNotLower
                    ? 'Estimated emissions avoided: 0.00 kg CO2e (chosen factor is not lower than replaced mode).'
                    : `Estimated emissions avoided: ~${estimatedSavingsKg.toFixed(2)} kg CO2e`
                  : 'Enter your approximate distance to calculate estimated CO2e avoided.'}
              </p>
              <button
                type="submit"
                disabled={!validDistance}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2E7D62] text-white text-sm font-medium hover:bg-[#24654F] disabled:opacity-40 transition-colors inline-flex items-center justify-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Log trip</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleLogQuickAction(preset)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] hover:bg-[#EEF6F2] hover:border-[#2E7D62] text-xs sm:text-sm text-[#1F2937] text-left transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleLogQuickAction(customAction);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={customAction}
                maxLength={LIMITS.MAX_ACTION_TEXT_CHARS}
                onChange={(e) => setCustomAction(e.target.value)}
                placeholder="Or describe another clean-air step you took…"
                aria-label="Custom sustainable action"
                className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAF9] focus:bg-white focus:border-[#2E7D62] text-sm text-[#1F2937] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!customAction.trim()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#2E7D62] text-white text-sm font-medium hover:bg-[#24654F] disabled:opacity-40 transition-colors shrink-0"
              >
                Add
              </button>
            </form>
          </div>
        )}

        {/* Transparent & configurable assumptions */}
        <div className="pt-3 border-t border-[#E5E7EB]">
          <button
            type="button"
            aria-expanded={showAssumptions}
            onClick={() => setShowAssumptions((prev) => !prev)}
            className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#1F2937] transition-colors"
          >
            <span>Assumptions & configurable emissions factors</span>
            {showAssumptions ? (
              <ChevronUp className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          {showAssumptions && (
            <div className="mt-3 p-4 rounded-xl bg-[#F8FAF9] border border-[#E5E7EB] space-y-4 text-xs text-[#374151]">
              <p className="leading-relaxed">
                CO2e savings are rough estimates calculated as{' '}
                <code className="font-mono text-[#1F2937]">
                  (replaced_factor − chosen_factor) × distance_km
                </code>
                . Real-world emissions depend on vehicle fuel, occupancy, and
                local electricity grids—these figures are approximations, not
                exact measurements.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FACTOR_FIELDS.map(({ key, label }) => (
                  <label key={key} className="block space-y-1">
                    <span className="block font-medium text-[#1F2937]">
                      {label}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={emissionFactors[key]}
                      onChange={(e) =>
                        onUpdateFactors({
                          ...emissionFactors,
                          [key]: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="w-full min-h-[44px] px-2.5 py-1 rounded-lg border border-[#E5E7EB] bg-white tabular-nums text-[#1F2937]"
                    />
                  </label>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onUpdateFactors(DEFAULT_EMISSION_FACTORS)}
                className="min-h-[44px] inline-flex items-center gap-1.5 text-xs font-medium text-[#23634D] hover:underline"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reset to default factors</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Completed actions list */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[#1F2937]">
          Completed actions
        </h2>

        {actions.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 text-center space-y-1.5">
            <p className="text-sm font-medium text-[#1F2937]">
              No actions logged yet
            </p>
            <p className="text-xs sm:text-sm text-[#4B5563]">
              Log a low-emission trip above or check off habits in Daily Tips to
              see your progress here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-2xl divide-y divide-[#E5E7EB]">
            {actions.map((item) => (
              <div
                key={item.id}
                className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-[#2E7D62] shrink-0 mt-1" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm text-[#1F2937]">{item.description}</p>
                    <p className="text-xs text-[#4B5563] mt-0.5 tabular-nums">
                      {formatActionDate(item.timestamp)}
                      {item.co2AvoidedKg > 0 && (
                        <>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span className="text-[#23634D] font-medium">
                            ~{item.co2AvoidedKg.toFixed(2)} kg CO2e avoided
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveAction(item.id)}
                  aria-label={`Remove action: ${item.description}`}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] hover:text-[#991B1B] hover:bg-[#FEF2F2] transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="py-2 flex items-center justify-center gap-2 text-sm text-[#4B5563]">
        <Leaf className="w-4 h-4 text-[#2E7D62]" aria-hidden="true" />
        <span>Small choices can make a meaningful difference.</span>
      </div>
    </div>
  );
}
