import { describe, it, expect } from 'vitest';
import { passesFeatureFilter } from '../nodes/shared/filter';

const payload = { data: { new_state: { feature: { name: 'dark_mode' } } } };

describe('passesFeatureFilter', () => {
  it('passes everything when filter is empty', () => {
    expect(passesFeatureFilter(payload, [])).toBe(true);
  });
  it('passes when feature name is in the filter', () => {
    expect(passesFeatureFilter(payload, ['dark_mode', 'x'])).toBe(true);
  });
  it('blocks when feature name is not in the filter', () => {
    expect(passesFeatureFilter(payload, ['other'])).toBe(false);
  });
  it('blocks when the payload has no feature name and filter is set', () => {
    expect(passesFeatureFilter({ data: {} }, ['dark_mode'])).toBe(false);
  });
});
