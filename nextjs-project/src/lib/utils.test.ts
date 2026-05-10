import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges Tailwind classes correctly', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('resolves conflicting Tailwind classes (last wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('filters falsy values', () => {
    expect(cn('px-4', undefined, null, false, 'py-2')).toBe('px-4 py-2');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });
});
