// Recognises the flag API failures a user can act on, mirroring the Flagsmith
// CLI (internal/api/client.go, classifyFlagWrite).

// The first Flagsmith release with the flag API (/api/__future__/…/features/…).
export const MIN_FLAG_WRITE_VERSION = '2.263.0';

// The error code the flag API returns, alongside a 409, when the environment
// only accepts changes through a change request.
const CHANGE_REQUESTS_CODE = 'change_requests_enabled';

export type FlagWriteOutcome = 'ok' | 'changeRequestsEnabled' | 'unsupported' | 'error';

function detailOf(body: unknown): unknown {
  return body && typeof body === 'object' ? (body as { detail?: unknown }).detail : undefined;
}

export function classifyFlagWrite(statusCode: number, body: unknown): FlagWriteOutcome {
  if (statusCode >= 200 && statusCode < 300) return 'ok';
  // Branch on the machine-readable code, not the status or the prose detail.
  if (
    statusCode === 409 &&
    body &&
    typeof body === 'object' &&
    (body as { code?: unknown }).code === CHANGE_REQUESTS_CODE
  ) {
    return 'changeRequestsEnabled';
  }
  // The flag API returns its own 404, with a detail, for an environment or
  // feature the caller can't see. A 404 without one means the route isn't there:
  // the instance is too old to have the flag API.
  if (statusCode === 404 && !detailOf(body)) return 'unsupported';
  return 'error';
}

// Flagsmith serves /version/ at the root of the instance, next to /api/.
export function versionUrl(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '') + '/version/';
}

// Reads the release from a /version/ response. Self-hosted instances often tag
// images with something that isn't a version ("latest", a commit sha), so
// anything that doesn't look like one is treated as unknown rather than old.
export function serverVersionFrom(body: unknown): string | undefined {
  const tag = body && typeof body === 'object' ? (body as { image_tag?: unknown }).image_tag : undefined;
  if (typeof tag !== 'string') return undefined;
  return /^v?\d+\.\d+\.\d+/.test(tag) ? tag.replace(/^v/, '') : undefined;
}

export function unsupportedMessage(serverVersion: string | undefined): string {
  const base = `Updating flags needs Flagsmith ${MIN_FLAG_WRITE_VERSION} or later`;
  return serverVersion ? `${base}; this instance runs ${serverVersion}` : base;
}
