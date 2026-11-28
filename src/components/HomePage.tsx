import { useState } from 'react';
import {
  AlertTriangle,
  Bus,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Home as HomeIcon,
  Leaf,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { getPollutantStatus, getSeverityStyle } from '../shared/aqi.ts';
import { IMAGE_ASSETS } from '../shared/constants.ts';
import type {
  AdviceRecommendations,
  AirQualityData,
  AqiScale,
  UserPreferences,
} from '../shared/types.ts';
import { AqiArcGauge } from './AqiArcGauge.tsx';
import { OnboardingBanner } from './OnboardingBanner.tsx';

interface HomePageProps {
  preferences: UserPreferences;
  aqiData: AirQualityData | null;
  aqiLoading: boolean;
  aqiError: string | null;
  advice: AdviceRecommendations | null;
  adviceLoading: boolean;
  demoMode: boolean;
  onRefreshAqi: () => void;
  onChangeScale: (scale: AqiScale) => void;
  onOpenLocationPicker: () => void;
  onOpenPreferences: () => void;
  onUpdatePreferences: (next: UserPreferences) => void;
  onEnableDemoMode: () => void;
  onOpenAssistant: () => void;
  onOpenDailyTips: () => void;
}

type AdviceFocus = 'outdoor' | 'indoor' | 'travel';

function formatMeasuredTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatHourlyTimeLabel(isoTime: string, idx: number, fallback: string): string {
  if (idx === 0) return 'Now';
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function CircularIllustIcon({
  src,
  alt,
  active,
  fallback,
}: {
  src: string;
  alt: string;
  active?: boolean;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <span
      className={`w-14 h-14 rounded-full border-2 overflow-hidden flex items-center justify-center bg-white transition-colors ${
        active
          ? 'border-[#2E7D62] ring-2 ring-[#2E7D62]/15'
          : 'border-[#E5E7EB] group-hover:border-[#2E7D62]'
      }`}
    >
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[#2E7D62]">{fallback}</span>
      )}
    </span>
  );
}

function AdviceCard({
  title,
  icon,
  active,
  loading,
  body,
  why,
  skeletonWidths,
}: {
  title: string;
  icon: React.ReactNode;
  active: boolean;
  loading: boolean;
  body?: string;
  why?: string;
  skeletonWidths: [string, string];
}) {
  return (
    <article
      className={`rounded-2xl border p-4 transition-colors ${
        active
          ? 'bg-[#EEF6F2]/60 border-[#CFE4DA]'
          : 'bg-[#F8FAF9] border-[#E5E7EB]'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <h3 className="text-sm font-semibold text-[#1F2937]">{title}</h3>
      </div>
      {loading ? (
        <div className="space-y-1.5 py-1" aria-label={`Loading ${title.toLowerCase()} advice`}>
          <div className={`h-3 bg-[#E5E7EB] rounded animate-pulse ${skeletonWidths[0]}`} />
          <div className={`h-3 bg-[#E5E7EB] rounded animate-pulse ${skeletonWidths[1]}`} />
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
            {body}
          </p>
          {why && (
            <p className="pt-2 border-t border-[#E5E7EB]/80 text-xs text-[#4B5563] leading-relaxed">
              <span className="font-semibold text-[#23634D]">Why it helps:</span>{' '}
              {why}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

export function HomePage({
  preferences,
  aqiData,
  aqiLoading,
  aqiError,
  advice,
  adviceLoading,
  demoMode,
  onRefreshAqi,
  onChangeScale,
  onOpenLocationPicker,
  onOpenPreferences,
  onUpdatePreferences,
  onEnableDemoMode,
  onOpenAssistant,
  onOpenDailyTips,
}: HomePageProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState<AdviceFocus>('outdoor');
  const [showHourly, setShowHourly] = useState(true);
  const [showPollutants, setShowPollutants] = useState(true);
  const [skyImgFailed, setSkyImgFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const pollutantCards = aqiData
    ? [
        {
          id: 'pm25' as const,
          label: 'PM2.5',
          value: aqiData.pollutants.pm25,
          unit: 'µg/m³',
        },
        {
          id: 'pm10' as const,
          label: 'PM10',
          value: aqiData.pollutants.pm10,
          unit: 'µg/m³',
        },
        {
          id: 'no2' as const,
          label: 'NO2',
          value: aqiData.pollutants.no2,
          unit: 'µg/m³',
        },
        {
          id: 'o3' as const,
          label: 'O3',
          value: aqiData.pollutants.o3,
          unit: 'µg/m³',
        },
      ]
    : [];

  const bestHourly =
    aqiData?.hourly && aqiData.hourly.length > 0
      ? aqiData.hourly.reduce(
          (best, cur, idx) =>
            cur.aqi < best.slot.aqi ? { slot: cur, idx } : best,
          { slot: aqiData.hourly[0], idx: 0 },
        )
      : null;
  const bestHourlyLabel = bestHourly
    ? formatHourlyTimeLabel(
        bestHourly.slot.isoTime,
        bestHourly.idx,
        bestHourly.slot.timeLabel,
      )
    : '';

  const friendlyHeadline = advice?.summary
    ? advice.summary
    : aqiData
      ? aqiData.severityLevel <= 2
        ? `Take a breath of fresh air — ${aqiData.city.name} air quality is ${aqiData.categoryLabel.toLowerCase()} today.`
        : `${aqiData.city.name} air quality is ${aqiData.categoryLabel.toLowerCase()} right now. Plan lighter outdoor time.`
      : 'Check local air quality and get tailored daily guidance.';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2937]">
            AirWise
          </h1>
          <p className="text-sm sm:text-base text-[#4B5563] mt-0.5">
            Breathe better, live smarter.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={onOpenLocationPicker}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#E5E7EB] hover:border-[#2E7D62] text-sm font-medium text-[#1F2937] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-[#2E7D62] shrink-0" />
            <span className="truncate max-w-[160px] sm:max-w-[200px]">
              {preferences.city.name}
            </span>
            <ChevronDown className="w-4 h-4 text-[#4B5563] shrink-0" />
          </button>

          <button
            type="button"
            onClick={onOpenPreferences}
            aria-label="Edit household preferences"
            title="Household preferences"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white border border-[#E5E7EB] hover:border-[#2E7D62] text-[#4B5563] hover:text-[#1F2937] transition-colors shrink-0"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Optional 3-question onboarding */}
      {!preferences.onboardingCompleted && (
        <OnboardingBanner
          preferences={preferences}
          onComplete={onUpdatePreferences}
          onSkip={() =>
            onUpdatePreferences({
              ...preferences,
              onboardingCompleted: true,
            })
          }
          onOpenLocationPicker={onOpenLocationPicker}
        />
      )}

      {/* Main Responsive Split: Atmospheric Hero Gauge Card + White "For today" Sheet */}
      {aqiLoading && !aqiData ? (
        <div
          role="status"
          aria-live="polite"
          className="bg-white border border-[#E5E7EB] rounded-3xl py-16 flex flex-col items-center justify-center text-center gap-3"
        >
          <Loader2 className="w-6 h-6 text-[#2E7D62] animate-spin" aria-hidden="true" />
          <p className="text-sm text-[#4B5563]">
            Checking air quality in {preferences.city.name}…
          </p>
        </div>
      ) : aqiError && !aqiData ? (
        <div
          role="alert"
          className="bg-white border border-[#E5E7EB] rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-[#1F2937]">
                Unable to load live air quality
              </h2>
              <p className="text-sm text-[#4B5563] mt-1">{aqiError}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefreshAqi}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#2E7D62] text-white text-sm font-medium hover:bg-[#24654F] transition-colors"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onEnableDemoMode}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F8FAF9] border border-[#E5E7EB] text-[#1F2937] text-sm font-medium hover:bg-[#EEF6F2] transition-colors"
            >
              View Demo Mode (Sample Data)
            </button>
          </div>
        </div>
      ) : aqiData ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-6 items-start">
          {/* LEFT / TOP: Atmospheric Sky Hero AQI Gauge Card */}
          <section
            aria-label="Current air quality gauge"
            className="lg:col-span-5 relative overflow-hidden rounded-t-3xl lg:rounded-3xl border border-[#DCE5DF] bg-[#E5EEE8] p-5 pb-10 lg:pb-6"
          >
            {!skyImgFailed && (
              <img
                src={IMAGE_ASSETS.HERO_SKY}
                alt=""
                aria-hidden="true"
                referrerPolicy="no-referrer"
                onError={() => setSkyImgFailed(true)}
                className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-90"
              />
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#E4EDE7]/55 via-[#EDF3EF]/60 to-[#F5F8F6]/88"
            />

            <div className="relative z-10 space-y-4">
              {(aqiData.isDemo || demoMode || aqiData.isStale || aqiError) && (
                <div
                  role="status"
                  className="rounded-xl bg-[#FEF7EC]/95 border border-[#F5DFB8] px-3.5 py-2 flex items-center justify-between gap-2 text-xs text-[#925209]"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      {aqiData.isDemo
                        ? 'Demo Mode: Sample data, not live readings.'
                        : aqiError || aqiData.notice}
                    </span>
                  </span>
                  {aqiData.isDemo && (
                    <button
                      type="button"
                      onClick={onOpenLocationPicker}
                      className="min-h-[36px] px-1.5 font-semibold underline shrink-0"
                    >
                      Live data
                    </button>
                  )}
                </div>
              )}

              {/* Top hero row: location + scale toggle + refresh */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onOpenLocationPicker}
                  className="min-h-[44px] flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[#1F2937] hover:text-[#23634D] transition-colors min-w-0"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#2E7D62] shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {aqiData.city.name}
                    {aqiData.city.country ? `, ${aqiData.city.country}` : ''}
                  </span>
                </button>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className="flex items-center p-0.5 rounded-lg bg-white/90 border border-[#D4DFD8]"
                    role="group"
                    aria-label="AQI scale selector"
                  >
                    <button
                      type="button"
                      aria-pressed={aqiData.scale === 'india'}
                      onClick={() => onChangeScale('india')}
                      className={`min-h-[40px] px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        aqiData.scale === 'india'
                          ? 'bg-white text-[#1F2937] shadow-xs'
                          : 'text-[#4B5563] hover:text-[#1F2937]'
                      }`}
                    >
                      India NAQI
                    </button>
                    <button
                      type="button"
                      aria-pressed={aqiData.scale === 'us'}
                      onClick={() => onChangeScale('us')}
                      className={`min-h-[40px] px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                        aqiData.scale === 'us'
                          ? 'bg-white text-[#1F2937] shadow-xs'
                          : 'text-[#4B5563] hover:text-[#1F2937]'
                      }`}
                    >
                      US AQI
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onRefreshAqi}
                    disabled={aqiLoading}
                    aria-label="Refresh air quality data"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-white/90 border border-[#D4DFD8] text-[#374151] hover:bg-white transition-colors"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${aqiLoading ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Semicircle Gauge & Big Numeral */}
              <AqiArcGauge
                aqi={aqiData.aqi}
                scale={aqiData.scale}
                categoryLabel={aqiData.categoryLabel}
                severityLevel={aqiData.severityLevel}
                detailsExpanded={detailsExpanded}
                onToggleDetails={() => setDetailsExpanded((v) => !v)}
              />

              {/* Plain-language explanation */}
              <p className="text-xs sm:text-sm text-[#1F2937] text-center leading-relaxed max-w-sm mx-auto">
                {aqiData.explanation}
              </p>

              {/* Expandable "See more" extra details */}
              {detailsExpanded && (
                <div className="rounded-2xl bg-white/95 border border-[#D4DFD8] p-4 space-y-2.5 text-xs text-[#374151]">
                  <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                    <span>
                      <strong className="text-[#1F2937]">SO2:</strong>{' '}
                      {aqiData.pollutants.so2 !== null
                        ? `${aqiData.pollutants.so2} µg/m³`
                        : '—'}
                    </span>
                    <span>
                      <strong className="text-[#1F2937]">CO:</strong>{' '}
                      {aqiData.pollutants.co !== null
                        ? `${aqiData.pollutants.co} µg/m³`
                        : '—'}
                    </span>
                    <span>
                      <strong className="text-[#1F2937]">Dominant:</strong>{' '}
                      {aqiData.dominantPollutant || 'Mixed'}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[#E5E7EB] text-xs text-[#4B5563]">
                    Note: Individual pollutant concentrations are measured in
                    µg/m³ and converted separately into the{' '}
                    {aqiData.scale === 'india' ? 'India NAQI' : 'US EPA AQI'}{' '}
                    scale.
                  </div>
                </div>
              )}

              {/* Clean unboxed timestamp & source */}
              <div className="text-xs text-[#374151] text-center">
                <span>Updated {formatMeasuredTime(aqiData.measuredAt)}</span>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span>
                  {aqiData.isDemo
                    ? aqiData.dataSource
                    : `${aqiData.dataSource} (${aqiData.scale === 'india' ? 'CPCB NAQI' : 'US EPA'})`}
                </span>
                {aqiData.city.isSample && (
                  <>
                    <span aria-hidden="true" className="mx-1.5">
                      ·
                    </span>
                    <span>Sample city</span>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT / OVERLAPPING WHITE SHEET: "For today", Hourly, Pollutants, Advice */}
          <div className="lg:col-span-7 -mt-5 lg:mt-0 relative z-20 bg-white border border-[#E5E7EB] rounded-3xl p-5 sm:p-6 space-y-6 shadow-xs">
            {/* "For today" bubble + 4 circular illustrated buttons */}
            <section aria-label="For today summary" className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[#1F2937]">
                  For today
                </h2>
                {advice?.notice && (
                  <span className="text-xs text-[#4B5563]">
                    {advice.notice}
                  </span>
                )}
              </div>

              {/* Friendly guide speech card with generated avatar */}
              <div className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8FAF9] px-4 py-3">
                {!avatarFailed ? (
                  <img
                    src={IMAGE_ASSETS.GUIDE_AVATAR}
                    alt="AirWise guide"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-10 h-10 rounded-full object-cover border border-[#CFE4DA] shrink-0 bg-[#EEF6F2]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#EEF6F2] border border-[#CFE4DA] flex items-center justify-center text-[#2E7D62] shrink-0">
                    <Leaf className="w-4 h-4" />
                  </div>
                )}
                <p className="text-sm text-[#1F2937] leading-snug">
                  {friendlyHeadline}
                </p>
              </div>

              {/* 4 Circular Illustrated Quick Buttons (Outdoor, Indoor, Travel, Routine) */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  aria-pressed={selectedFocus === 'outdoor'}
                  onClick={() => setSelectedFocus('outdoor')}
                  className="flex flex-col items-center gap-1.5 group min-h-[44px] py-1"
                >
                  <CircularIllustIcon
                    src={IMAGE_ASSETS.ICON_OUTDOOR}
                    alt=""
                    active={selectedFocus === 'outdoor'}
                    fallback={<Sun className="w-5 h-5" />}
                  />
                  <span className="text-xs font-medium text-[#1F2937]">
                    Outdoor
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={selectedFocus === 'indoor'}
                  onClick={() => setSelectedFocus('indoor')}
                  className="flex flex-col items-center gap-1.5 group min-h-[44px] py-1"
                >
                  <CircularIllustIcon
                    src={IMAGE_ASSETS.ICON_INDOOR}
                    alt=""
                    active={selectedFocus === 'indoor'}
                    fallback={<HomeIcon className="w-5 h-5" />}
                  />
                  <span className="text-xs font-medium text-[#1F2937]">
                    Indoor
                  </span>
                </button>

                <button
                  type="button"
                  aria-pressed={selectedFocus === 'travel'}
                  onClick={() => setSelectedFocus('travel')}
                  className="flex flex-col items-center gap-1.5 group min-h-[44px] py-1"
                >
                  <CircularIllustIcon
                    src={IMAGE_ASSETS.ICON_TRAVEL}
                    alt=""
                    active={selectedFocus === 'travel'}
                    fallback={<Bus className="w-5 h-5" />}
                  />
                  <span className="text-xs font-medium text-[#1F2937]">
                    Travel
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenDailyTips}
                  className="flex flex-col items-center gap-1.5 group min-h-[44px] py-1"
                >
                  <CircularIllustIcon
                    src={IMAGE_ASSETS.ICON_ROUTINE}
                    alt=""
                    fallback={<CheckSquare className="w-5 h-5" />}
                  />
                  <span className="text-xs font-medium text-[#1F2937]">
                    Routine
                  </span>
                </button>
              </div>
            </section>

            {/* Three Today's Advice Cards */}
            <section aria-label="Today's personalized advice" className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <AdviceCard
                  title="Outdoor Activity"
                  icon={<Sun className="w-4 h-4 text-[#2E7D62] shrink-0" aria-hidden="true" />}
                  active={selectedFocus === 'outdoor'}
                  loading={adviceLoading && !advice}
                  body={advice?.outdoor}
                  why={advice?.outdoorWhy}
                  skeletonWidths={['w-full', 'w-4/5']}
                />
                <AdviceCard
                  title="Indoor Air"
                  icon={<HomeIcon className="w-4 h-4 text-[#2E7D62] shrink-0" aria-hidden="true" />}
                  active={selectedFocus === 'indoor'}
                  loading={adviceLoading && !advice}
                  body={advice?.indoor}
                  why={advice?.indoorWhy}
                  skeletonWidths={['w-full', 'w-3/4']}
                />
                <AdviceCard
                  title="Travel Choice"
                  icon={<Bus className="w-4 h-4 text-[#2E7D62] shrink-0" aria-hidden="true" />}
                  active={selectedFocus === 'travel'}
                  loading={adviceLoading && !advice}
                  body={advice?.travel}
                  why={advice?.travelWhy}
                  skeletonWidths={['w-full', 'w-5/6']}
                />
              </div>
            </section>

            {/* Hourly outlook row */}
            {aqiData.hourly && aqiData.hourly.length > 0 && bestHourly && (
              <section aria-label="Hourly air quality outlook" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-expanded={showHourly}
                    onClick={() => setShowHourly((v) => !v)}
                    className="min-h-[44px] inline-flex items-center gap-1 text-sm font-semibold text-[#1F2937] hover:text-[#23634D] transition-colors"
                  >
                    <span>Hourly outlook</span>
                    <ChevronRight
                      className={`w-4 h-4 transition-transform ${showHourly ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  <span className="text-xs text-[#23634D] font-medium tabular-nums">
                    {bestHourly.idx === 0
                      ? `Cleanest right now (AQI ${bestHourly.slot.aqi})`
                      : `Cleaner window around ${bestHourlyLabel} (AQI ${bestHourly.slot.aqi})`}
                  </span>
                </div>

                {showHourly && (
                  <div className="grid grid-cols-4 gap-2.5">
                    {aqiData.hourly.map((slot, idx) => {
                      const slotStyle = getSeverityStyle(slot.severityLevel);
                      const isNow = idx === 0;
                      const label = formatHourlyTimeLabel(
                        slot.isoTime,
                        idx,
                        slot.timeLabel,
                      );
                      return (
                        <div
                          key={`${slot.isoTime || slot.timeLabel}-${idx}`}
                          className={`rounded-2xl py-3 px-2 text-center border ${
                            isNow
                              ? 'bg-white border-[#2E7D62]'
                              : 'bg-[#F8FAF9] border-[#E5E7EB]'
                          }`}
                        >
                          <div className="text-xs text-[#4B5563] font-medium">
                            {label}
                          </div>
                          <div
                            className="mt-1 text-lg font-bold tabular-nums"
                            style={{ color: slotStyle.accentHex }}
                          >
                            {slot.aqi}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Pollutants row */}
            <section aria-label="Measured pollutants" className="space-y-3">
              <button
                type="button"
                aria-expanded={showPollutants}
                onClick={() => setShowPollutants((v) => !v)}
                className="min-h-[44px] inline-flex items-center gap-1 text-sm font-semibold text-[#1F2937] hover:text-[#23634D] transition-colors"
              >
                <span>Pollutants</span>
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${showPollutants ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {showPollutants && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {pollutantCards.map((p) => {
                    const status = getPollutantStatus(
                      p.id,
                      p.value,
                      aqiData.scale,
                    );
                    return (
                      <div
                        key={p.id}
                        className={`rounded-2xl border bg-white px-3 py-3 text-center ${status.borderClass}`}
                      >
                        <div className="text-xs font-semibold text-[#1F2937]">
                          {p.label}
                        </div>
                        <div className="mt-1 text-xs text-[#374151] tabular-nums">
                          {p.value !== null ? `${p.value} ${p.unit}` : '—'}
                        </div>
                        <div
                          className={`mt-1 text-xs font-medium ${status.colorClass}`}
                        >
                          {status.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Primary Ask AirWise Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenAssistant}
                className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#2E7D62] text-white font-semibold text-base hover:bg-[#24654F] transition-colors inline-flex items-center justify-center gap-2.5 shadow-xs"
              >
                <MessageCircle className="w-5 h-5" aria-hidden="true" />
                <span>Ask AirWise</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
