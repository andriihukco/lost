// Animal avatars for players. Each animal comes with its predefined nickname: a player picks an animal and gets
// its nickname, so nicknames are never typed by hand and stay unique (the animal is unique). The keys must match the
// check constraint in migration 0003 (enforced by tests/avatars.test.ts). Nicknames are Ukrainian two-word names
// where the adjective agrees with the animal's grammatical gender.
export const AVATARS = [
  { key: 'fox', emoji: '🦊', nickname: 'Хитра Лисиця' },
  { key: 'bear', emoji: '🐻', nickname: 'Сильний Ведмідь' },
  { key: 'panda', emoji: '🐼', nickname: 'Спокійна Панда' },
  { key: 'koala', emoji: '🐨', nickname: 'Сонна Коала' },
  { key: 'tiger', emoji: '🐯', nickname: 'Грізний Тигр' },
  { key: 'lion', emoji: '🦁', nickname: 'Гордий Лев' },
  { key: 'frog', emoji: '🐸', nickname: 'Весела Жаба' },
  { key: 'monkey', emoji: '🐵', nickname: 'Щаслива Мавпа' },
  { key: 'penguin', emoji: '🐧', nickname: 'Холодний Пінгвін' },
  { key: 'rabbit', emoji: '🐰', nickname: 'Швидкий Кролик' },
  { key: 'pig', emoji: '🐷', nickname: 'Рожева Свинка' },
  { key: 'cow', emoji: '🐮', nickname: 'Мирна Корова' },
  { key: 'dog', emoji: '🐶', nickname: 'Вірний Песик' },
  { key: 'cat', emoji: '🐱', nickname: 'Дикий Кіт' },
  { key: 'octopus', emoji: '🐙', nickname: 'Розумний Восьминіг' },
  { key: 'owl', emoji: '🦉', nickname: 'Мудра Сова' },
  { key: 'unicorn', emoji: '🦄', nickname: 'Чарівний Єдиноріг' },
  { key: 'turtle', emoji: '🐢', nickname: 'Повільна Черепаха' },
] as const;

export type AvatarKey = (typeof AVATARS)[number]['key'];

export function avatarEmoji(key: string): string {
  return AVATARS.find((a) => a.key === key)?.emoji ?? '👤';
}

// The predefined nickname of an animal, or null for an unknown key.
export function nicknameFor(key: string): string | null {
  return AVATARS.find((a) => a.key === key)?.nickname ?? null;
}

// An animal is taken when another player has it. My own animal stays available to me.
export function isTaken(key: string, takenKeys: string[], mine: string | null): boolean {
  return takenKeys.includes(key) && key !== mine;
}

export function availableAvatars(takenKeys: string[], mine: string | null) {
  return AVATARS.filter((a) => !isTaken(a.key, takenKeys, mine));
}
