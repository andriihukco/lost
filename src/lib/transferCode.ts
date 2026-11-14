// The check for a profile-transfer code, kept apart from the server calls so it can be tested without a connection.
export const TRANSFER_CODE_LENGTH = 6;
export const TRANSFER_MINUTES = 10;

export function isTransferCode(text: string): boolean {
  return new RegExp(`^\\d{${TRANSFER_CODE_LENGTH}}$`).test(text.trim());
}
