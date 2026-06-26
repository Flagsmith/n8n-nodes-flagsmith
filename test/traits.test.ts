import { describe, it, expect } from 'vitest';
import { buildTraits } from '../nodes/shared/traits';

describe('buildTraits', () => {
  it('maps a fixedCollection trait list to the API array', () => {
    const input = { trait: [
      { key: 'plan', value: 'enterprise' },
      { key: 'seats', value: 25 },
      { key: 'beta', value: true },
    ] };
    expect(buildTraits(input)).toEqual([
      { trait_key: 'plan', trait_value: 'enterprise' },
      { trait_key: 'seats', trait_value: 25 },
      { trait_key: 'beta', trait_value: true },
    ]);
  });
  it('returns an empty array when no traits are provided', () => {
    expect(buildTraits({})).toEqual([]);
    expect(buildTraits({ trait: [] })).toEqual([]);
  });
});
