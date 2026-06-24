import React, { useId } from 'react';
import { GTM_MARK_VIEWBOX, markPath, showBackground, type GtmMarkVariant } from './gtmMarkArt';

export type GtmMarkSvgProps = {
  size?: number;
  className?: string;
  variant?: GtmMarkVariant;
  title?: string;
};

/**
 * GetTrainMate — Apex Confluence: one continuous mark, three paths → connection.
 */
export const GtmMarkSvg: React.FC<GtmMarkSvgProps> = ({
  size = 32,
  className,
  variant = 'navbar',
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const fillGrad = `gtm-fill-${uid}`;
  const glass = `gtm-glass-${uid}`;
  const withBg = showBackground(variant);
  const d = markPath(variant);

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
        <linearGradient id={fillGrad} x1="12" y1="4" x2="36" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="0.55" stopColor="#A855F7" />
          <stop offset="1" stopColor="#FFB347" />
        </linearGradient>
        <linearGradient id={glass} x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.12" />
          <stop offset="0.45" stopColor="#FFFFFF" stopOpacity="0.03" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {withBg ? (
        <>
          <rect x="1" y="1" width="46" height="46" rx="11" fill="#0B1020" />
          {variant === 'main' ? <rect x="1" y="1" width="46" height="46" rx="11" fill={`url(#${glass})`} /> : null}
        </>
      ) : null}

      <path d={d} fill={`url(#${fillGrad})`} />
    </svg>
  );
};
