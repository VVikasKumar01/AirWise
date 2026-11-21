import { useId } from 'react';
import { getSeverityStyle } from '../shared/aqi.ts';
import type { AqiScale, SeverityLevel } from '../shared/types.ts';

interface AqiArcGaugeProps {
  aqi: number;
  scale: AqiScale;
  categoryLabel: string;
  severityLevel: SeverityLevel;
  detailsExpanded: boolean;
  onToggleDetails: () => void;
}

export function AqiArcGauge({
  aqi,
  scale,
  categoryLabel,
  severityLevel,
  detailsExpanded,
  onToggleDetails,
}: AqiArcGaugeProps) {
  const gradId = `airwiseArcGrad-${useId().replace(/:/g, '')}`;
  const style = getSeverityStyle(severityLevel);
  // Map AQI 0-350+ onto a 180-degree semicircle
  const ratio = Math.min(1, Math.max(0.03, aqi / 350));

  const cx = 150;
  const cy = 132;
  const r = 104;

  // Semicircle from left (180 deg) to right (0 deg)
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;

  const angleRad = Math.PI * (1 - ratio);
  const markerX = cx + r * Math.cos(angleRad);
  const markerY = cy - r * Math.sin(angleRad);

  const arcLength = Math.PI * r;
  const dashOffset = arcLength * (1 - ratio);

  return (
    <div className="flex flex-col items-center">
      {/* Big AQI Numeral with dual green leaf accent */}
      <div className="relative inline-flex items-start justify-center mt-1">
        <span
          className="text-6xl sm:text-7xl font-bold tracking-tight tabular-nums leading-none"
          style={{ color: style.accentHex }}
        >
          {aqi}
        </span>

        {/* Signature two-leaf botanical mark */}
        <svg
          width="28"
          height="26"
          viewBox="0 0 28 26"
          fill="none"
          aria-hidden="true"
          className="-mt-1 ml-1 shrink-0"
        >
          <path
            d="M4 22C4 12.5 10.5 6 19 6C19 14.5 12.5 22 4 22Z"
            fill="#2E7D62"
          />
          <path
            d="M17 14C17 8.5 21 4 26 4C26 9.5 22 14 17 14Z"
            fill="#56A87D"
          />
        </svg>
      </div>

      <div className="mt-1.5 text-xs font-medium text-[#374151]">
        {scale === 'india' ? 'India NAQI' : 'US AQI'}
        <span aria-hidden="true" className="mx-1.5">
          ·
        </span>
        <span className={`font-semibold ${style.textClass}`}>
          {categoryLabel}
        </span>
      </div>

      {/* Curved Radial Arc */}
      <div className="relative w-full max-w-[300px] mt-1">
        <svg
          viewBox="0 0 300 152"
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label={`Air Quality Index ${aqi}, ${categoryLabel}`}
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#84CC16" />
              <stop offset="45%" stopColor="#2E7D62" />
              <stop offset="75%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>

          {/* Outer subtle radial ticks & scale labels */}
          <path
            d={`M ${cx - 126} ${cy} A 126 126 0 0 1 ${cx + 126} ${cy}`}
            fill="none"
            stroke="rgba(31, 41, 55, 0.14)"
            strokeWidth="1"
          />
          <line
            x1={cx}
            y1={cy - 126}
            x2={cx}
            y2={cy - 116}
            stroke="rgba(31, 41, 55, 0.28)"
            strokeWidth="1.25"
          />
          <text
            x={cx - 112}
            y={cy - 68}
            textAnchor="middle"
            className="fill-[#374151] text-[10px] font-medium"
          >
            Low
          </text>
          <text
            x={cx}
            y={cy - 132}
            textAnchor="middle"
            className="fill-[#374151] text-[10px] font-medium"
          >
            Moderate
          </text>
          <text
            x={cx + 114}
            y={cy - 68}
            textAnchor="middle"
            className="fill-[#374151] text-[10px] font-medium"
          >
            High
          </text>

          {/* Background track arc */}
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
            fill="none"
            stroke="rgba(31, 41, 55, 0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />

          {/* Active progress arc */}
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={dashOffset}
            className="transition-all duration-500"
          />

          {/* Current AQI marker on arc */}
          <circle
            cx={markerX}
            cy={markerY}
            r="7"
            fill="#FFFFFF"
            stroke={style.accentHex}
            strokeWidth="3.5"
          />
        </svg>

        <button
          type="button"
          onClick={onToggleDetails}
          aria-expanded={detailsExpanded}
          className="absolute left-1/2 -translate-x-1/2 bottom-1 min-h-[44px] px-4 py-2 rounded-full bg-white/95 hover:bg-white border border-[#D4DFD8] text-xs font-medium text-[#1F2937] shadow-xs transition-colors whitespace-nowrap"
        >
          {detailsExpanded ? 'Hide details' : 'See more'}
        </button>
      </div>
    </div>
  );
}
