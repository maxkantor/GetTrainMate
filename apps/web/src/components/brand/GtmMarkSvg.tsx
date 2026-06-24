import React, { useId } from 'react';
import { GTM_MARK_VIEWBOX, markPath, showBackground, type GtmMarkVariant } from './gtmMarkArt';

export type GtmMarkSvgProps = {
  size?: number;
  className?: string;
  variant?: GtmMarkVariant;
  title?: string;
};

/** GetTrainMate T-Mark — premium lettermark silhouette */
export const GtmMarkSvg: React.FC<GtmMarkSvgProps> = ({
  size = 32,
  className,
  variant = 'navbar',
  title,
}) => {
  const uid = useId().replace(/:/g, '');
  const fillGrad = `gtm-t-${uid}`;
  const withBg = showBackground(variant);

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
        <linearGradient id={fillGrad} x1="10" y1="10" x2="38" y2="43" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="0.55" stopColor="#A855F7" />
          <stop offset="1" stopColor="#FFB347" />
        </linearGradient>
      </defs>

      {withBg ? <rect x="1" y="1" width="46" height="46" rx="11" fill="#0B1020" /> : null}

      <path d={markPath(variant)} fill={`url(#${fillGrad})`} />
    </svg>
  );
};
