// First-run welcome: shown once, then remembered in this browser.
export const WELCOME_KEY = 'lost.welcomed.v1';
export const WELCOME_STEPS = ['intro', 'location', 'compass'] as const;
export type WelcomeStep = (typeof WELCOME_STEPS)[number];

export function isWelcomed(storage: Storage): boolean {
  try {
    return storage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomed(storage: Storage): void {
  try {
    storage.setItem(WELCOME_KEY, '1');
  } catch {
    // storage blocked: the welcome may show again next visit
  }
}
