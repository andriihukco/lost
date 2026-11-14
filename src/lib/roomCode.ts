// 31 characters: no 0/o, 1/l/i. Stored without a hyphen (decision D6).
export const ROOM_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

const CODE_LENGTH = 6;

const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export function generateRoomCode(random: () => number = cryptoRandom): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}
