import React, { useId } from 'react';
import {
  BRAND_GRADIENT,
  DARK_GRADIENT,
  GTM_MARK_VIEWBOX,
  backgroundFill,
  backgroundRadius,
  getRings,
  isMonochrome,
  ringDonutPath,
  showBackground,
  type GtmMarkVariant,
} from './gtmMarkArt';

export type GtmMarkSvgProps = {
  size?: number;
  className?: string;
  variant?: GtmMarkVariant;
  title?: string;
};

/** GetTrainMate Interlock Rings — official brand mark */
export const GtmMarkSvg: React.FC<GtmMarkSvgProps> = ({
  size = 32,
  className,
  variant = 'navbar',
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const gradId = `gtm-rings-${uid}`;
  const withBg = showBackground(variant);
  const mono = isMonochrome(variant);
  const dark = variant === 'dark';
  const palette = dark ? DARK_GRADIENT : BRAND_GRADIENT;
  const rings = getRings(variant);

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
      {!mono ? (
        <defs>
          <linearGradient id={gradId} x1="11" y1="12" x2="37" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor={palette.start} />
            <stop offset="0.72" stopColor={palette.mid} />
            <stop offset="1" stopColor={palette.accent} stopOpacity={dark ? 0.85 : 0.65} />
          </linearGradient>
        </defs>
      ) : null}

      {withBg ? (
        <rect
          x="1"
          y="1"
          width="46"
          height="46"
          rx={backgroundRadius(variant)}
          fill={backgroundFill(variant)}
        />
      ) : null}

      {rings.map((ring, i) => (
        <path
          key={i}
          fillRule="evenodd"
          clipRule="evenodd"
          d={ringDonutPath(ring)}
          fill={mono ? '#FFFFFF' : `url(#${gradId})`}
        />
      ))}
    </svg>
  );
};
