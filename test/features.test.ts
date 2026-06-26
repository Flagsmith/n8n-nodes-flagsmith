import { describe, it, expect } from 'vitest';
import { mapFeaturesToOptions, experimentsBaseUrl } from '../nodes/shared/features';

describe('mapFeaturesToOptions', () => {
  it('maps features to {name, feature id} for the dropdown', () => {
    const features = [
      { id: 211824, name: 'demo_experiment' },
      { id: 211825, name: 'new_checkout' },
    ];
    expect(mapFeaturesToOptions(features)).toEqual([
      { name: 'demo_experiment', value: 211824 },
      { name: 'new_checkout', value: 211825 },
    ]);
  });
  it('returns [] for an empty list', () => {
    expect(mapFeaturesToOptions([])).toEqual([]);
  });
});

describe('experimentsBaseUrl', () => {
  it('rewrites the SaaS /api/v1 base to /api/experiments', () => {
    expect(experimentsBaseUrl('https://api.flagsmith.com/api/v1')).toBe(
      'https://api.flagsmith.com/api/experiments',
    );
  });
  it('handles a trailing slash', () => {
    expect(experimentsBaseUrl('https://api.flagsmith.com/api/v1/')).toBe(
      'https://api.flagsmith.com/api/experiments',
    );
  });
  it('rewrites self-hosted / Private Cloud overrides', () => {
    expect(experimentsBaseUrl('https://flagsmith.example.com/api/v1')).toBe(
      'https://flagsmith.example.com/api/experiments',
    );
  });
});
