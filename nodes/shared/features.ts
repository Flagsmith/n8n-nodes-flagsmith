// Flagsmith identifies a feature by a numeric id within a project. The
// flag API and the feature dropdown both work off that id, so the
// project features list is all we need — no environment feature states, no join.
export interface Feature {
  id: number;
  name: string;
}

export interface NodePropertyOption {
  name: string;
  value: number;
}

export function mapFeaturesToOptions(features: Feature[]): NodePropertyOption[] {
  return features.map((f) => ({ name: f.name, value: f.id }));
}

// The flag API lives under /api/__future__, a sibling of the /api/v1 admin
// base. Derive it from the configured base URL so it keeps working for
// self-hosted / Private Cloud overrides too.
export function flagApiBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v1\/?$/, '/api/__future__');
}
