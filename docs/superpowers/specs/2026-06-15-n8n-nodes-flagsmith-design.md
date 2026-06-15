# n8n-nodes-flagsmith — Design Spec

**Date:** 2026-06-15
**Owner:** Asaph Kotzin (Head of Product, Flagsmith)
**Status:** Approved for implementation planning.

## Objective

Ship a verified n8n community node for Flagsmith that lets n8n users react to and control feature flags inside their workflows. Top-of-funnel / activation play: distribution into the n8n canvas, reaching the ops/RevOps/automation audience the Flagsmith MCP server (devs in IDEs) does not touch.

Deliverable: one npm package, `n8n-nodes-flagsmith`, with two node classes plus two credentials, built to pass n8n verification so it is installable from the n8n Cloud canvas, not just self-hosted.

## Scope

In scope for v1: four action operations across three resources, plus one webhook trigger node.

Cut from v1: Create Feature (desk/CI work, not event-reactive; revisit in v1.1). Explicit non-goals: segment create/edit, change requests, release pipelines, multivariate config, environment/project provisioning, a "watch flag" polling action, and a dedicated percentage-rollout primitive. These belong to the dashboard, the MCP server, or Terraform.

## Package shape

- Name `n8n-nodes-flagsmith`, MIT license, keyword `n8n-community-node-package`.
- Registers 2 nodes + 2 credentials under the `n8n` attribute in `package.json`.
- Node.js 22+; scaffolded from `npm create @n8n/node` (declarative template).
- Zero runtime dependencies. All HTTP goes through n8n request helpers. No `flagsmith-nodejs` or any SDK.

## Credentials

Two credential types, surfaced contextually via `displayOptions` keyed on the selected resource so only the relevant one is shown/required.

### `flagsmithAdminApi` (management / control plane)
- Fields: `apiToken` (password), `baseUrl` (default `https://api.flagsmith.com/api/v1`, overridable for self-hosted/Private Cloud).
- Auth: injects header `Authorization: Api-Key {apiToken}`.
- Credential test: `GET /projects/`.
- Used by: Update Feature State, and the Trigger node's webhook registration.

### `flagsmithEnvironment` (evaluation / edge)
- Fields: `environmentKey` (password), `baseUrl` (default `https://edge.api.flagsmith.com/api/v1`, overridable).
- Auth: injects header `X-Environment-Key: {environmentKey}`.
- Credential test: `GET /flags/`.
- Used by: Set Trait, Get Identity Flags, Get Flags.

Note on base URLs: SaaS splits Admin (`api.`) from Flags (`edge.api.`). Self-hosted typically serves both from one host at `/api/v1/`. Both base URLs are editable credential fields. All paths use trailing slashes (Flagsmith redirects/fails without them).

## Action node `Flagsmith` (declarative)

Resource dropdown then per-resource operations. One branded node; users never reason about which API surface backs an operation.

| Resource | Operation | Credential | Request |
|---|---|---|---|
| Feature | Update Feature State | Admin | `PATCH /environments/{env}/featurestates/{fsId}/` body `{enabled?, feature_state_value?}` |
| Identity | Set Trait | Environment | `POST /identities/` body `{identifier, traits[]}` |
| Identity | Get Identity Flags | Environment | `GET /identities/?identifier={identifier}` |
| Environment | Get Flags | Environment | `GET /flags/` |

### Parameters and the feature-state resolution trick
- **Project** and **Environment** are node parameters (not dependent cascades). Environment is supplied as the environment `api_key`.
- **Update Feature State** needs a lookup-then-write, which a declarative operation cannot express as two calls. Resolution: the **Feature** field is a `loadOptions` dropdown that calls `GET /environments/{env}/featurestates/` and maps each entry to `{ label: feature.name, value: featurestate.id }`, with `loadOptionsDependsOn` the Environment parameter. The dropdown does the name to feature-state-id resolution at design time, so execution is a single PATCH against `featurestates/{value}/`.
- **Enabled** (boolean) and **Value** (string) are both optional; the operation sends only the fields the user sets (partial PATCH). `feature_state_value` accepts string/number/boolean/null.
- **Set Trait** uses a Traits fixed-collection (repeatable key/value pairs) assembled into the `traits[]` body via a routing `preSend`. `POST /identities/` lazy-creates the identity, persists traits, and re-evaluates segments in one call.

## Trigger node `Flagsmith Trigger` (programmatic webhook)

Triggers must be programmatic in n8n (they implement webhook-lifecycle methods), so this node is programmatic rather than declarative. The zero-runtime-dependency rule still holds. Uses the **Admin** credential.

- **Parameters:** Environment (api_key); optional Feature filter (only fire for named features); event-type passthrough.
- **`create` (on activation):** generate a secret, `POST /environments/{env}/webhooks/` with the n8n-issued webhook URL, `enabled: true`, and the secret. Store the returned webhook `id` + secret in node static data.
- **`delete` (on deactivation):** `DELETE /environments/{env}/webhooks/{id}/`.
- **`webhook` (on event):** verify `X-Flagsmith-Signature` (HMAC-SHA256 over the raw request body, key = stored secret) with a constant-time compare; reject with 401 on mismatch. Emit `data.new_state`, `data.previous_state`, and `data.changed_by`. Apply the optional Feature filter. `event_type` is treated as a free string (the full enum is not documented; historically `FLAG_UPDATED`).
- This is the environment "Web hook" (Environment Settings -> Webhooks), not the analytics integration webhook. Payload shape: `{ event_type, data: { changed_by, new_state, previous_state } }`.

## Error handling and edges

- Surface Flagsmith API errors with status code and response body.
- Honor n8n "Continue on Fail" on every action operation.
- Enforce trailing slashes on all paths.
- Trigger rejects invalid signatures (401); if no secret is configured, accept but warn.
- Self-hosted base-URL override on both credentials.

## Testing strategy

- `npm run lint` clean (with `--fix` during dev).
- Local n8n via `npm run dev`; manually exercise all four action operations plus the trigger round-trip against a throwaway Flagsmith project.
- Unit tests for the two pure functions: the `X-Flagsmith-Signature` verifier and the traits-array builder.
- Trigger round-trip requires Flagsmith to reach n8n's public webhook URL: local dev needs a tunnel (n8n dev tunnel or ngrok) or a hosted n8n.

## Build, publish, verification

- GitHub repo in the Flagsmith org; Flagsmith-owned npm package.
- GitHub Actions publish workflow with npm provenance (`--provenance`) and Trusted Publisher / `NPM_TOKEN`; `@n8n/node-cli` >= 0.23.0. Required since 1 May 2026: verified nodes must be published via CI with provenance, not from a local machine. This is a current hard gate, set it up from day zero.
- README in the package covering both credentials, the four operations, the trigger, and self-host install instructions; follow n8n node UX guidelines.
- Submit via the n8n Creator Portal for vetting.
- Risk to gut-check before submission: n8n may reject nodes that compete with its own paid/enterprise features. Flag operations (toggle, set value, set trait, read flags) are unlikely to collide; keep scope to flag operations.

## Verified API reference (resolves brief open questions)

Admin API, base `https://api.flagsmith.com/api/v1/`, header `Authorization: Api-Key <token>`:
- List projects: `GET /projects/?organisation={org_id}`
- List environments: `GET /environments/?project={project_id}` (each has `id`, `name`, `api_key`)
- List features: `GET /projects/{project_id}/features/`
- List environment feature states: `GET /environments/{env_api_key}/featurestates/?feature={feature_id}` (each item's `id` is the feature-state id)
- Update feature state: `PATCH /environments/{env_api_key}/featurestates/{fs_id}/` body `{enabled, feature_state_value}`
- Webhook CRUD: `GET|POST /environments/{env_api_key}/webhooks/`, `PATCH|DELETE /environments/{env_api_key}/webhooks/{id}/`; create body `{url, enabled, secret}`

Flags / Edge API, base `https://edge.api.flagsmith.com/api/v1/`, header `X-Environment-Key: <key>`:
- All flags: `GET /flags/`
- Identity flags + traits: `GET /identities/?identifier={identifier}` -> `{flags[], traits[]}`
- Set traits: `POST /identities/` body `{identifier, traits: [{trait_key, trait_value}]}` -> re-evaluated `{flags[], traits[]}`

Webhook trigger payload: `{ event_type: "FLAG_UPDATED", data: { changed_by, new_state: {enabled, environment, feature, feature_state_value, identity, ...}, previous_state: {...} } }`. Signature: `X-Flagsmith-Signature` = HMAC-SHA256 hex of the raw UTF-8 body keyed by the webhook secret.

## What is needed from the owner at build/test time

- Sandbox: an org API token + one environment key + the project/environment names.
- A reachable n8n for the trigger round-trip (tunnel or hosted).
- The Flagsmith-org GitHub repo + npm publish rights / Trusted Publisher config (needed only for the verified-publish step, not the build).
