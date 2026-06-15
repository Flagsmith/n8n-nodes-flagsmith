import { describe, it, expect } from 'vitest';
import { mapFeatureStatesToOptions } from '../nodes/shared/featureStates';

describe('mapFeatureStatesToOptions', () => {
  it('joins feature-states to feature names by feature id', () => {
    // The Admin featurestates endpoint returns `feature` as an id, not an object,
    // so names come from the project features list and are joined on the id.
    const states = [
      { id: 1442707, feature: 211824 },
      { id: 1442708, feature: 211825 },
    ];
    const features = [
      { id: 211824, name: 'demo_experiment' },
      { id: 211825, name: 'new_checkout' },
    ];
    expect(mapFeatureStatesToOptions(states, features)).toEqual([
      { name: 'demo_experiment', value: 1442707 },
      { name: 'new_checkout', value: 1442708 },
    ]);
  });
  it('falls back to a feature-id label when the name is unknown', () => {
    expect(mapFeatureStatesToOptions([{ id: 1, feature: 999 }], [])).toEqual([
      { name: 'feature 999', value: 1 },
    ]);
  });
  it('returns [] for an empty list', () => {
    expect(mapFeatureStatesToOptions([], [])).toEqual([]);
  });
});
