// @ts-ignore -- bun's built-in test runner; types not installed for the app typecheck
import { describe, expect, it } from 'bun:test';
import { isPeriodEditable } from './payrollPeriod';

describe('isPeriodEditable', () => {
  it('allows draft weeks', () => expect(isPeriodEditable('draft')).toBe(true));
  it('blocks completed weeks', () => expect(isPeriodEditable('completed')).toBe(false));
});
