import React, { useId } from 'react';

export type GtmMarkSvgProps = {
  size?: number;
  className?: string;
  /** Slightly bolder strokes for favicon-scale rendering */
  bold?: boolean;
  title?: string;
};

/**
 * GetTrainMate brand mark — two connected figures + energy spark (fitness + connection).
 */
export const GtmMarkSvg: React.FC<GtmMarkSvgProps> = ({
  size = 32,
  className,
  bold = false,
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const grad = `gtm-grad-${uid}`;
  const glow = `gtm-glow-${uid}`;
  const stroke = bold ? 2.4 : 2;
  const headR = bold ? 3.6 : 3.2;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={grad} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B5CF6" />
          <stop offset="0.45" stopColor="#D946EF" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <radialGradient id={glow} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(20 18) rotate(90) scale(18)">
          <stop stopColor="#A78BFA" stopOpacity="0.35" />
          <stop offset="1" stopColor="#F97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="3" y="3" width="34" height="34" rx="10" fill={`url(#${glow})`} />
      <rect
        x="3"
        y="3"
        width="34"
        height="34"
        rx="10"
        stroke={`url(#${grad})`}
        strokeWidth="1.6"
        fill="rgba(12, 10, 28, 0.55)"
      />

      {/* Left figure */}
      <circle cx="13.5" cy="13.5" r={headR} fill={`url(#${grad})`} />
      <path
        d="M8.5 28.5c0.8-4.2 3.2-6.5 5-6.5s4.2 2.3 5 6.5"
        stroke={`url(#${grad})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />

      {/* Right figure */}
      <circle cx="26.5" cy="13.5" r={headR} fill={`url(#${grad})`} />
      <path
        d="M21.5 28.5c0.8-4.2 3.2-6.5 5-6.5s4.2 2.3 5 6.5"
        stroke={`url(#${grad})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />

      {/* Connection + energy */}
      <path
        d="M16.5 20.5c1.2 1.4 2.8 2.1 3.5 2.1s2.3-0.7 3.5-2.1"
        stroke={`url(#${grad})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M20 15.5v3.5M18.25 17.25h3.5"
        stroke="#FBBF24"
        strokeWidth={bold ? 2 : 1.6}
        strokeLinecap="round"
      />
      <path
        d="M20 22.5l-1.4 2.4h2.8L20 22.5Z"
        fill="#FBBF24"
      />
    </svg>
  );
};
