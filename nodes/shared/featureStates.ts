// The Flagsmith Admin featurestates endpoint returns `feature` as the feature id
// (a number), not a nested object. Feature names live on the project features
// endpoint, so the dropdown joins the two by feature id.
export interface FeatureState {
  id: number; // feature-state id, used to PATCH the state
  feature: number; // feature id
}

export interface Feature {
  id: number;
  name: string;
}

export interface NodePropertyOption {
  name: string;
  value: number;
}

export function mapFeatureStatesToOptions(
  states: FeatureState[],
  features: Feature[],
): NodePropertyOption[] {
  const nameById = new Map(features.map((f) => [f.id, f.name]));
  return states.map((s) => ({ name: nameById.get(s.feature) ?? `feature ${s.feature}`, value: s.id }));
}
