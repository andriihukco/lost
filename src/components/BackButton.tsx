'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';

const STYLE =
  'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--ink)] elev-sm transition-transform active:scale-95 disabled:opacity-40';

// The one back button of the app, for players and admins: a 44 px round button that belongs at the top-left of a
// screen, where iOS puts "back". Pass href for a page link, or onClick for a step inside a screen.
export default function BackButton({
  label,
  href,
  onClick,
  disabled = false,
  className = '',
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (href) {
    return (
      <Link href={href} aria-label={label} className={`${STYLE} ${className}`}>
        <Icon name="arrow_back" size={22} />
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className={`${STYLE} ${className}`}>
      <Icon name="arrow_back" size={22} />
    </button>
  );
}
