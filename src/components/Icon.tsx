import { ICON_PATHS, type IconName } from '@/components/iconPaths';

// Material Symbols icon. Decorative by default; pass a label only when the icon is the sole content of a control
// without visible text (the control itself keeps the aria-label).
export default function Icon({ name, filled = false, size = 24, className }: { name: IconName; filled?: boolean; size?: number; className?: string }) {
  const key = filled && `${name}-fill` in ICON_PATHS ? (`${name}-fill` as IconName) : name;
  const paths: readonly string[] = ICON_PATHS[key];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={className}
    >
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
