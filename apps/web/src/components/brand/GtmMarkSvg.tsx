import React, { useId } from 'react';
import {
  GTM_MARK_VIEWBOX,
  HIDDEN_T,
  NODE_DATE,
  NODE_TRAIN,
  NODE_VIBE,
  PATH_DATE_TRAIN,
  PATH_TRAIN_VIBE,
  PATH_VIBE_DATE,
  type GtmMarkVariant,
  showBackground,
  showHiddenDetails,
  showNodeRings,
  strokeWidthFor,
} from './gtmMarkArt';

export type GtmMarkSvgProps = {
  size?: number;
  className?: string;
  variant?: GtmMarkVariant;
  title?: string;
};

/**
 * GetTrainMate — three-node connection mark (Train · Vibe · Date).
 */
export const GtmMarkSvg: React.FC<GtmMarkSvgProps> = ({
  size = 32,
  className,
  variant = 'navbar',
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const primary = `gtm-p-${uid}`;
  const accent = `gtm-a-${uid}`;
  const pathGrad = `gtm-pg-${uid}`;
  const glass = `gtm-g-${uid}`;
  const glow = `gtm-gl-${uid}`;
  const sw = strokeWidthFor(variant);
  const withBg = showBackground(variant);
  const details = showHiddenDetails(variant);
  const rings = showNodeRings(variant);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${GTM_MARK_VIEWBOX} ${GTM_MARK_VIEWBOX}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={primary} x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id={accent} x1="26" y1="26" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB347" />
          <stop offset="1" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id={pathGrad} x1="10" y1="12" x2="38" y2="38" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="0.5" stopColor="#A855F7" />
          <stop offset="1" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id={glass} x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.02" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={glow} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.1" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {withBg ? (
        <>
          <rect x="1" y="1" width="46" height="46" rx="11" fill="#0B1020" />
          <rect x="1" y="1" width="46" height="46" rx="11" fill={`url(#${glass})`} />
          <rect
            x="1"
            y="1"
            width="46"
            height="46"
            rx="11"
            stroke={`url(#${primary})`}
            strokeOpacity={0.32}
            strokeWidth="1"
          />
        </>
      ) : null}

      <path
        d={PATH_TRAIN_VIBE}
        stroke={`url(#${primary})`}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={PATH_VIBE_DATE}
        stroke={`url(#${pathGrad})`}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={PATH_DATE_TRAIN}
        stroke={`url(#${primary})`}
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />

      {details ? (
        <path
          d={HIDDEN_T}
          stroke="#7C5CFF"
          strokeOpacity={0.16}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ) : null}

      {/* TRAIN — energy / growth */}
      <circle
        cx={NODE_TRAIN.cx}
        cy={NODE_TRAIN.cy}
        r={variant === 'favicon' ? 5.6 : NODE_TRAIN.r}
        fill={`url(#${primary})`}
        filter={withBg ? `url(#${glow})` : undefined}
      />
      {details ? (
        <path
          d="M24 5.8v2.2"
          stroke={`url(#${accent})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity={0.9}
        />
      ) : null}
      {rings && variant !== 'favicon' ? (
        <circle cx={NODE_TRAIN.cx} cy={NODE_TRAIN.cy} r="2.1" fill="#EDE9FE" fillOpacity={0.45} />
      ) : null}

      {/* VIBE — community */}
      <circle
        cx={NODE_VIBE.cx}
        cy={NODE_VIBE.cy}
        r={variant === 'favicon' ? 5.2 : NODE_VIBE.r}
        fill={`url(#${primary})`}
      />
      {rings ? (
        <circle
          cx={NODE_VIBE.cx}
          cy={NODE_VIBE.cy}
          r={variant === 'favicon' ? 0 : 6.6}
          stroke="#7C5CFF"
          strokeOpacity={0.28}
          strokeWidth="1"
          fill="none"
        />
      ) : null}

      {/* DATE — chemistry */}
      <circle
        cx={NODE_DATE.cx}
        cy={NODE_DATE.cy}
        r={variant === 'favicon' ? 5.2 : NODE_DATE.r}
        fill={`url(#${primary})`}
      />
      {rings ? (
        <circle
          cx={NODE_DATE.cx}
          cy={NODE_DATE.cy}
          r={variant === 'favicon' ? 7.2 : 6.9}
          stroke={`url(#${accent})`}
          strokeOpacity={variant === 'favicon' ? 1 : 0.88}
          strokeWidth={variant === 'favicon' ? 1.6 : 1.35}
          fill="none"
        />
      ) : null}
    </svg>
  );
};
