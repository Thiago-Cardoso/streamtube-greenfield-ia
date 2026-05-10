import { sanitizeNickname, appendRandomSuffix } from './nickname.util';

describe('sanitizeNickname', () => {
  it('lowercases and removes invalid characters (dots and hyphens stripped)', () => {
    expect(sanitizeNickname('HelloWorld')).toBe('helloworld');
    expect(sanitizeNickname('user.name-test')).toBe('usernametest');
  });

  it('strips characters that are not a-z, 0-9, or underscore', () => {
    const result = sanitizeNickname('user.name-test!@#');
    expect(/^[a-z0-9_]*$/.test(result)).toBe(true);
  });

  it('returns user_XXXX prefix when prefix is empty after sanitization', () => {
    const result = sanitizeNickname('!!!');
    expect(result).toMatch(/^user_[a-z0-9]{8}$/);
  });

  it('truncates to 46 characters max', () => {
    const longPrefix = 'a'.repeat(60);
    const result = sanitizeNickname(longPrefix);
    expect(result.length).toBeLessThanOrEqual(46);
  });

  it('handles email prefix with numbers and underscores', () => {
    const result = sanitizeNickname('user_123');
    expect(result).toBe('user_123');
  });

  it('produces only lowercase result', () => {
    const result = sanitizeNickname('UPPERCASE123');
    expect(result).toBe('uppercase123');
  });
});

describe('appendRandomSuffix', () => {
  it('appends a random 3-char alphanumeric suffix with underscore', () => {
    const result = appendRandomSuffix('mynickname');
    expect(result).toMatch(/^mynickname_[a-z0-9]{3}$/);
  });

  it('keeps total length at or below 50 characters', () => {
    const longNick = 'a'.repeat(46);
    const result = appendRandomSuffix(longNick);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('produces different results on successive calls', () => {
    const results = new Set(Array.from({ length: 10 }, () => appendRandomSuffix('test')));
    expect(results.size).toBeGreaterThan(1);
  });
});
