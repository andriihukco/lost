import Icon from '@/components/Icon';

// Loading screen: the app mark with a soft pulse and an indeterminate bar. Announced to screen readers as a status.
export default function Splash({ label = 'Завантаження' }: { label?: string }) {
  return (
    <main role="status" aria-live="polite" className="flex min-h-dvh flex-col items-center justify-center gap-7 bg-[var(--page)] p-6">
      <div className="relative grid h-28 w-28 place-items-center">
        <span aria-hidden className="lost-pulse absolute inset-0 rounded-full bg-[var(--green-soft)]" />
        <span className="relative grid h-24 w-24 place-items-center rounded-full border-[3px] border-[var(--green)] bg-[var(--paper)] text-[var(--green-deep)] shadow-[0_6px_0_var(--green-deep)]">
          <Icon name="travel_explore" size={44} />
        </span>
      </div>
      <p className="dl-title text-[28px]">Lost</p>
      <div aria-hidden className="h-1.5 w-40 overflow-hidden rounded-full bg-[var(--line)]">
        <span className="lost-bar block h-full w-1/3 rounded-full bg-[var(--green)]" />
      </div>
      <p className="sr-only">{label}…</p>
    </main>
  );
}
