import { describe, it, expect } from 'vitest';
import { mapFeaturesToOptions } from '../nodes/shared/featureStates';

describe('mapFeaturesToOptions', () => {
  it('maps features to {name, feature-state id} from the inline environment_feature_state', () => {
    // The features endpoint, queried with ?environment=<id>, returns each
    // feature's environment state inline. We label by feature name and use the
    // environment_feature_state id as the value (what we PATCH).
    const features = [
      { id: 211824, name: 'demo_experiment', environment_feature_state: { id: 1442707 } },
      { id: 211825, name: 'new_checkout', environment_feature_state: { id: 1442708 } },
    ];
    expect(mapFeaturesToOptions(features)).toEqual([
      { name: 'demo_experiment', value: 1442707 },
      { name: 'new_checkout', value: 1442708 },
    ]);
  });
  it('skips features that have no environment feature state (nothing to PATCH)', () => {
    const features = [
      { id: 1, name: 'orphan', environment_feature_state: null },
      { id: 2, name: 'live', environment_feature_state: { id: 99 } },
    ];
    expect(mapFeaturesToOptions(features)).toEqual([{ name: 'live', value: 99 }]);
  });
  it('returns [] for an empty list', () => {
    expect(mapFeaturesToOptions([])).toEqual([]);
  });
});
