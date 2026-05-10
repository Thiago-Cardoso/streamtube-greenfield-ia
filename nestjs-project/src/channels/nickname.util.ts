const MAX_NICKNAME_LENGTH = 50;
const BASE_MAX = 46;

export function sanitizeNickname(emailPrefix: string): string {
  const sanitized = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!sanitized) {
    return `user_${randomAlphanumeric(8)}`;
  }
  return sanitized.slice(0, BASE_MAX);
}

export function appendRandomSuffix(nickname: string): string {
  const suffix = `_${randomAlphanumeric(3)}`;
  const base = nickname.slice(0, MAX_NICKNAME_LENGTH - suffix.length);
  return `${base}${suffix}`;
}

function randomAlphanumeric(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
