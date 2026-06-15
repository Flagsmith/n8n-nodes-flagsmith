import { describe, it, expect } from 'vitest';
import { mapFeatureStatesToOptions } from '../nodes/shared/featureStates';

describe('mapFeatureStatesToOptions', () => {
  it('maps featurestates to {name: feature.name, value: featurestate.id}', () => {
    const res = [
      { id: 101, enabled: true, feature: { id: 1, name: 'dark_mode' } },
      { id: 102, enabled: false, feature: { id: 2, name: 'new_checkout' } },
    ];
    expect(mapFeatureStatesToOptions(res)).toEqual([
      { name: 'dark_mode', value: 101 },
      { name: 'new_checkout', value: 102 },
    ]);
  });
  it('returns [] for an empty list', () => {
    expect(mapFeatureStatesToOptions([])).toEqual([]);
  });
});
