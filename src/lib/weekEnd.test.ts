import { describe, expect, it } from 'bun:test';
import { resolveWeekEnd } from './weekEnd';

describe('resolveWeekEnd', () => {
  it('locked week ends Sunday, start + 6 days', () => {
    expect(resolveWeekEnd('2026-10-05', true, '2026-10-20')).toBe('2026-10-11');
  });
  it('unlocked uses the custom end date', () => {
    expect(resolveWeekEnd('2026-10-05', false, '2026-10-20')).toBe('2026-10-20');
  });
  it('unlocked end before start falls back to the full week', () => {
    expect(resolveWeekEnd('2026-10-05', false, '2026-10-01')).toBe('2026-10-11');
  });
});
