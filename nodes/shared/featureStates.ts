// The Flagsmith project features endpoint, when called with an `environment`
// query parameter, returns each feature's environment-level state inline as
// `environment_feature_state`. Its `id` is the feature-state id we PATCH; the
// human-readable name lives on the feature itself. So a single call gives us
// both the label and the value, with no client-side join.
export interface EnvironmentFeatureState {
  id: number; // feature-state id, used to PATCH the state
}

export interface Feature {
  id: number;
  name: string;
  // Present when the features endpoint is queried with `?environment=<id>`.
  // Null/absent if the feature has no environment-level state to target.
  environment_feature_state?: EnvironmentFeatureState | null;
}

export interface NodePropertyOption {
  name: string;
  value: number;
}

export function mapFeaturesToOptions(features: Feature[]): NodePropertyOption[] {
  return features
    .filter((f) => f.environment_feature_state != null)
    .map((f) => ({ name: f.name, value: f.environment_feature_state!.id }));
}
