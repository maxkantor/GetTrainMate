import React from 'react';
import { Link, LinkProps, useLocation, useResolvedPath } from 'react-router-dom';

/**
 * Like react-router {@link Link}, but when the target pathname is already active
 * (e.g. footer "Pricing" on /pricing), scroll to top instead of no-op navigation.
 */
export const SamePathScrollLink = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function SamePathScrollLink({ to, onClick, ...rest }, ref) {
    const location = useLocation();
    const resolved = useResolvedPath(to);

    const handleClick: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (location.pathname === resolved.pathname) {
        e.preventDefault();
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      }
    };

    return <Link ref={ref} to={to} {...rest} onClick={handleClick} />;
  }
);
