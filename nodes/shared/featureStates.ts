export interface FeatureState {
  id: number;
  feature: { id: number; name: string };
}

export interface NodePropertyOption {
  name: string;
  value: number;
}

export function mapFeatureStatesToOptions(states: FeatureState[]): NodePropertyOption[] {
  return states.map((s) => ({ name: s.feature.name, value: s.id }));
}
