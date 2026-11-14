// Animal avatars for players. The keys must match the check constraint in migration 0003
// (enforced by tests/avatars.test.ts).
export const AVATARS = [
  { key: 'fox', emoji: '🦊', label: 'Лис' },
  { key: 'bear', emoji: '🐻', label: 'Ведмідь' },
  { key: 'panda', emoji: '🐼', label: 'Панда' },
  { key: 'koala', emoji: '🐨', label: 'Коала' },
  { key: 'tiger', emoji: '🐯', label: 'Тигр' },
  { key: 'lion', emoji: '🦁', label: 'Лев' },
  { key: 'frog', emoji: '🐸', label: 'Жабка' },
  { key: 'monkey', emoji: '🐵', label: 'Мавпа' },
  { key: 'penguin', emoji: '🐧', label: 'Пінгвін' },
  { key: 'rabbit', emoji: '🐰', label: 'Кролик' },
  { key: 'pig', emoji: '🐷', label: 'Свинка' },
  { key: 'cow', emoji: '🐮', label: 'Корова' },
  { key: 'dog', emoji: '🐶', label: 'Песик' },
  { key: 'cat', emoji: '🐱', label: 'Котик' },
  { key: 'octopus', emoji: '🐙', label: 'Восьминіг' },
  { key: 'owl', emoji: '🦉', label: 'Сова' },
  { key: 'unicorn', emoji: '🦄', label: 'Єдиноріг' },
  { key: 'turtle', emoji: '🐢', label: 'Черепаха' },
] as const;

export type AvatarKey = (typeof AVATARS)[number]['key'];

export function avatarEmoji(key: string): string {
  return AVATARS.find((a) => a.key === key)?.emoji ?? '👤';
}

// An animal is taken when another player has it. My own animal stays available to me.
export function isTaken(key: string, takenKeys: string[], mine: string | null): boolean {
  return takenKeys.includes(key) && key !== mine;
}

export function availableAvatars(takenKeys: string[], mine: string | null) {
  return AVATARS.filter((a) => !isTaken(a.key, takenKeys, mine));
}
