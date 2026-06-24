import React, { useId } from 'react';
import {
  GTM_MARK_VIEWBOX,
  HIDDEN_GLYPH,
  MEETPOINT,
  ORIGIN_DATE,
  ORIGIN_TRAIN,
  ORIGIN_VIBE,
  PATH_DATE,
  PATH_FORWARD,
  PATH_TRAIN,
  PATH_VIBE,
  type GtmMarkVariant,
  meetRadius,
  showBackground,
  showForwardPath,
  showHiddenGlyphs,
  showOriginMarks,
  strokeWidthFor,
} from './gtmMarkArt';

export type GtmMarkSvgProps = {
  size?: number;
  className?: string;
  variant?: GtmMarkVariant;
  title?: string;
};

/**
 * GetTrainMate — three paths converging at one meetpoint (Train · Vibe · Date).
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
  const orbR = meetRadius(variant);

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
        <linearGradient id={accent} x1="22" y1="28" x2="38" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB347" />
          <stop offset="1" stopColor="#FF8A00" />
        </linearGradient>
        <linearGradient id={pathGrad} x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="0.45" stopColor="#A855F7" />
          <stop offset="1" stopColor="#FFB347" />
        </linearGradient>
        <linearGradient id={glass} x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.11" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0.02" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${uid}-orb`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(24 23.5) scale(7)">
          <stop stopColor="#C4B5FD" />
          <stop offset="0.55" stopColor="#A855F7" />
          <stop offset="1" stopColor="#7C5CFF" />
        </radialGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.25" result="b" />
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
            strokeOpacity={0.3}
            strokeWidth="1"
          />
        </>
      ) : null}

      {showOriginMarks(variant) ? (
        <>
          <circle cx={ORIGIN_TRAIN.cx} cy={ORIGIN_TRAIN.cy} r={ORIGIN_TRAIN.r} fill={`url(#${primary})`} />
          <circle cx={ORIGIN_VIBE.cx} cy={ORIGIN_VIBE.cy} r={ORIGIN_VIBE.r} fill={`url(#${primary})`} />
          <circle cx={ORIGIN_DATE.cx} cy={ORIGIN_DATE.cy} r={ORIGIN_DATE.r} fill={`url(#${accent})`} />
        </>
      ) : null}

      <path d={PATH_TRAIN} stroke={`url(#${primary})`} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={PATH_VIBE} stroke={`url(#${primary})`} strokeWidth={sw} strokeLinecap="round" fill="none" />
      <path d={PATH_DATE} stroke={`url(#${pathGrad})`} strokeWidth={sw} strokeLinecap="round" fill="none" />

      {showForwardPath(variant) ? (
        <path
          d={PATH_FORWARD}
          stroke={`url(#${accent})`}
          strokeWidth={variant === 'navbar' ? 2.6 : 2.4}
          strokeLinecap="round"
          fill="none"
          opacity={0.92}
        />
      ) : null}

      {showHiddenGlyphs(variant) ? (
        <path
          d={HIDDEN_GLYPH}
          stroke="#7C5CFF"
          strokeOpacity={0.13}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      ) : null}

      {/* Destination orb — union of three modes */}
      <circle
        cx={MEETPOINT.cx}
        cy={MEETPOINT.cy}
        r={orbR}
        fill={`url(#${uid}-orb)`}
        filter={withBg ? `url(#${glow})` : undefined}
      />
      <circle
        cx={MEETPOINT.cx}
        cy={MEETPOINT.cy}
        r={orbR + 1.2}
        stroke={`url(#${accent})`}
        strokeOpacity={variant === 'favicon' ? 0.55 : 0.35}
        strokeWidth={variant === 'favicon' ? 1.2 : 0.9}
        fill="none"
      />
      <circle
        cx={MEETPOINT.cx}
        cy={MEETPOINT.cy}
        r={variant === 'favicon' ? 2.4 : MEETPOINT.coreR}
        fill="#F5F3FF"
        fillOpacity={0.55}
      />
    </svg>
  );
};
