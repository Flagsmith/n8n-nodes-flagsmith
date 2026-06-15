# n8n-nodes-flagsmith Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship `n8n-nodes-flagsmith`, a verified n8n community node with a declarative `Flagsmith` action node (4 operations), a programmatic `Flagsmith Trigger` webhook node, and two credentials.

**Architecture:** Declarative action node maps each operation to a single REST request via `routing`; a `loadOptions` Feature dropdown resolves feature-state ids at design time so Update Feature State stays one PATCH. Pure helper functions (signature verification, traits-array builder, feature-state mapper, feature filter) are unit-tested with TDD; declarative descriptions and the trigger are verified by lint plus manual runs against a sandbox. The trigger node self-registers/deletes a Flagsmith environment webhook via the Admin API and verifies `X-Flagsmith-Signature`.

**Tech Stack:** TypeScript, n8n node API (`n8n-workflow`), `@n8n/node-cli` (declarative scaffold), Node 22+, vitest for unit tests, GitHub Actions + npm provenance for publishing. Zero runtime dependencies (Node builtin `crypto` only).

---

## Naming note (supersedes spec shorthand)

Credential `name` identifiers used throughout this plan: **`flagsmithAdminApi`** and **`flagsmithEnvironmentApi`** (the spec wrote the latter as `flagsmithEnvironment`; use `flagsmithEnvironmentApi` consistently in code). The Feature dropdown parameter that holds a feature-state id is named **`featureStateId`**.

## File structure

```
n8n-nodes-flagsmith/
├── credentials/
│   ├── FlagsmithAdminApi.credentials.ts
│   └── FlagsmithEnvironmentApi.credentials.ts
├── nodes/
│   ├── shared/
│   │   ├── signature.ts          # HMAC-SHA256 verify (pure)
│   │   ├── traits.ts             # fixedCollection -> traits[] (pure)
│   │   ├── featureStates.ts      # featurestates response -> INodePropertyOptions[] (pure)
│   │   └── filter.ts             # feature-name filter for trigger (pure)
│   ├── Flagsmith/
│   │   ├── Flagsmith.node.ts
│   │   ├── Flagsmith.node.json
│   │   ├── flagsmith.svg
│   │   ├── descriptions/
│   │   │   ├── FeatureDescription.ts
│   │   │   ├── IdentityDescription.ts
│   │   │   └── EnvironmentDescription.ts
│   │   └── methods/
│   │       └── loadOptions.ts
│   └── FlagsmithTrigger/
│       ├── FlagsmithTrigger.node.ts
│       ├── FlagsmithTrigger.node.json
│       └── flagsmith.svg
├── test/
│   ├── signature.test.ts
│   ├── traits.test.ts
│   ├── featureStates.test.ts
│   └── filter.test.ts
├── .github/workflows/publish.yml
├── package.json
├── README.md
└── (scaffold config: tsconfig, eslint, etc.)
```

---

## Task 1: Scaffold the package and lock metadata

**Files:**
- Create: whole repo skeleton via scaffold
- Modify: `package.json`

- [ ] **Step 1: Scaffold with the declarative template**

Run in the repo root (`/Users/asaphkotzin/Product/n8n-nodes-flagsmith`):
```bash
npm create @n8n/node@latest -- --template declarative .
```
If the CLI refuses to scaffold into a non-empty dir (the repo already has `docs/` and `.git/`), scaffold into a temp dir and copy:
```bash
cd /tmp && npm create @n8n/node@latest flagsmith-scaffold -- --template declarative
rsync -a --exclude=.git /tmp/flagsmith-scaffold/ /Users/asaphkotzin/Product/n8n-nodes-flagsmith/
```

- [ ] **Step 2: Inspect what the scaffold produced**

Run:
```bash
cd /Users/asaphkotzin/Product/n8n-nodes-flagsmith && ls -R nodes credentials && cat package.json && cat tsconfig.json
```
Expected: a sample node + credential, a `package.json` with an `n8n` attribute and `scripts` (`build`, `lint`, `dev`), and the `@n8n/node-cli` dev dependency. Note the test runner (if any) and the lint command.

- [ ] **Step 3: Set package.json metadata**

Ensure these fields (edit to match exactly; keep scaffold-provided scripts/devDeps):
```json
{
  "name": "n8n-nodes-flagsmith",
  "version": "0.1.0",
  "description": "n8n node to read and control Flagsmith feature flags, and trigger workflows on flag changes",
  "keywords": ["n8n-community-node-package", "flagsmith", "feature-flags"],
  "license": "MIT",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/FlagsmithAdminApi.credentials.js",
      "dist/credentials/FlagsmithEnvironmentApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/Flagsmith/Flagsmith.node.js",
      "dist/nodes/FlagsmithTrigger/FlagsmithTrigger.node.js"
    ]
  }
}
```

- [ ] **Step 4: Remove the scaffold's sample node and credential**

Delete the example node/credential directories the template created (keep the structure). Run `ls nodes credentials` to confirm only our intended dirs remain (create empty `nodes/Flagsmith`, `nodes/FlagsmithTrigger`, `nodes/shared` as needed).

- [ ] **Step 5: Ensure a test runner exists**

If `package.json` has no `test` script, add vitest (dev dependency only — does not violate the no-runtime-deps rule):
```bash
npm install -D vitest
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 6: Add a placeholder icon**

Add a `flagsmith.svg` to both `nodes/Flagsmith/` and `nodes/FlagsmithTrigger/` (use the official Flagsmith logo SVG; a simple square placeholder is acceptable until brand assets are dropped in).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold n8n-nodes-flagsmith package"
```

---

## Task 2: Credentials

**Files:**
- Create: `credentials/FlagsmithAdminApi.credentials.ts`
- Create: `credentials/FlagsmithEnvironmentApi.credentials.ts`

- [ ] **Step 1: Write the Admin credential**

`credentials/FlagsmithAdminApi.credentials.ts`:
```ts
import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class FlagsmithAdminApi implements ICredentialType {
  name = 'flagsmithAdminApi';
  displayName = 'Flagsmith Admin API';
  documentationUrl = 'https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/admin-api';
  properties: INodeProperties[] = [
    {
      displayName: 'Organisation API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.flagsmith.com/api/v1',
      description: 'Override for self-hosted or Private Cloud instances',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: { Authorization: '=Api-Key {{$credentials.apiToken}}' },
    },
  };

  test: ICredentialTestRequest = {
    request: { baseURL: '={{$credentials.baseUrl}}', url: '/projects/' },
  };
}
```

- [ ] **Step 2: Write the Environment credential**

`credentials/FlagsmithEnvironmentApi.credentials.ts`:
```ts
import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class FlagsmithEnvironmentApi implements ICredentialType {
  name = 'flagsmithEnvironmentApi';
  displayName = 'Flagsmith Environment Key';
  documentationUrl = 'https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/flags-api';
  properties: INodeProperties[] = [
    {
      displayName: 'Environment Key',
      name: 'environmentKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Client-side environment key',
    },
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://edge.api.flagsmith.com/api/v1',
      description: 'Override for self-hosted or Private Cloud instances',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: { 'X-Environment-Key': '={{$credentials.environmentKey}}' },
    },
  };

  test: ICredentialTestRequest = {
    request: { baseURL: '={{$credentials.baseUrl}}', url: '/flags/' },
  };
}
```

- [ ] **Step 3: Lint and commit**

Run: `npm run lint`
Expected: no errors for the two credential files (fix any `eslint-plugin-n8n-nodes-base` warnings, e.g. alphabetical ordering of properties).
```bash
git add credentials && git commit -m "feat: add Admin and Environment credentials"
```

---

## Task 3: Pure helper — HMAC signature verification (TDD)

**Files:**
- Test: `test/signature.test.ts`
- Create: `nodes/shared/signature.ts`

- [ ] **Step 1: Write the failing test**

`test/signature.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { isValidSignature } from '../nodes/shared/signature';

const secret = 'shhh';
const body = '{"event_type":"FLAG_UPDATED"}';
const goodSig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('isValidSignature', () => {
  it('accepts a correct signature', () => {
    expect(isValidSignature(body, goodSig, secret)).toBe(true);
  });
  it('rejects a wrong signature', () => {
    expect(isValidSignature(body, 'deadbeef', secret)).toBe(false);
  });
  it('rejects a missing signature', () => {
    expect(isValidSignature(body, undefined, secret)).toBe(false);
  });
  it('rejects when body is tampered', () => {
    expect(isValidSignature(body + ' ', goodSig, secret)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/signature.test.ts`
Expected: FAIL — cannot find module `../nodes/shared/signature`.

- [ ] **Step 3: Implement**

`nodes/shared/signature.ts`:
```ts
import { createHmac, timingSafeEqual } from 'crypto';

export function isValidSignature(
  rawBody: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/signature.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add test/signature.test.ts nodes/shared/signature.ts
git commit -m "feat: add webhook signature verification helper"
```

---

## Task 4: Pure helper — traits-array builder (TDD)

**Files:**
- Test: `test/traits.test.ts`
- Create: `nodes/shared/traits.ts`

- [ ] **Step 1: Write the failing test**

`test/traits.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildTraits } from '../nodes/shared/traits';

describe('buildTraits', () => {
  it('maps a fixedCollection trait list to the API array', () => {
    const input = { trait: [
      { key: 'plan', value: 'enterprise' },
      { key: 'seats', value: 25 },
      { key: 'beta', value: true },
    ] };
    expect(buildTraits(input)).toEqual([
      { trait_key: 'plan', trait_value: 'enterprise' },
      { trait_key: 'seats', trait_value: 25 },
      { trait_key: 'beta', trait_value: true },
    ]);
  });
  it('returns an empty array when no traits are provided', () => {
    expect(buildTraits({})).toEqual([]);
    expect(buildTraits({ trait: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/traits.test.ts`
Expected: FAIL — cannot find module `../nodes/shared/traits`.

- [ ] **Step 3: Implement**

`nodes/shared/traits.ts`:
```ts
export interface TraitEntry {
  key: string;
  value: string | number | boolean;
}

export interface TraitsCollection {
  trait?: TraitEntry[];
}

export interface ApiTrait {
  trait_key: string;
  trait_value: string | number | boolean;
}

export function buildTraits(collection: TraitsCollection): ApiTrait[] {
  const entries = collection.trait ?? [];
  return entries.map((e) => ({ trait_key: e.key, trait_value: e.value }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/traits.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add test/traits.test.ts nodes/shared/traits.ts
git commit -m "feat: add traits-array builder helper"
```

---

## Task 5: Pure helper — feature-state options mapper (TDD)

**Files:**
- Test: `test/featureStates.test.ts`
- Create: `nodes/shared/featureStates.ts`

- [ ] **Step 1: Write the failing test**

`test/featureStates.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/featureStates.test.ts`
Expected: FAIL — cannot find module `../nodes/shared/featureStates`.

- [ ] **Step 3: Implement**

`nodes/shared/featureStates.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/featureStates.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add test/featureStates.test.ts nodes/shared/featureStates.ts
git commit -m "feat: add feature-state options mapper"
```

---

## Task 6: Pure helper — trigger feature filter (TDD)

**Files:**
- Test: `test/filter.test.ts`
- Create: `nodes/shared/filter.ts`

- [ ] **Step 1: Write the failing test**

`test/filter.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { passesFeatureFilter } from '../nodes/shared/filter';

const payload = { data: { new_state: { feature: { name: 'dark_mode' } } } };

describe('passesFeatureFilter', () => {
  it('passes everything when filter is empty', () => {
    expect(passesFeatureFilter(payload, [])).toBe(true);
  });
  it('passes when feature name is in the filter', () => {
    expect(passesFeatureFilter(payload, ['dark_mode', 'x'])).toBe(true);
  });
  it('blocks when feature name is not in the filter', () => {
    expect(passesFeatureFilter(payload, ['other'])).toBe(false);
  });
  it('blocks when the payload has no feature name and filter is set', () => {
    expect(passesFeatureFilter({ data: {} }, ['dark_mode'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/filter.test.ts`
Expected: FAIL — cannot find module `../nodes/shared/filter`.

- [ ] **Step 3: Implement**

`nodes/shared/filter.ts`:
```ts
export function passesFeatureFilter(payload: any, featureNames: string[]): boolean {
  if (!featureNames.length) return true;
  const name = payload?.data?.new_state?.feature?.name;
  if (!name) return false;
  return featureNames.includes(name);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/filter.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add test/filter.test.ts nodes/shared/filter.ts
git commit -m "feat: add trigger feature filter helper"
```

---

## Task 7: Action node — Environment resource (Get Flags)

Build the simplest operation first to lock the declarative skeleton.

**Files:**
- Create: `nodes/Flagsmith/descriptions/EnvironmentDescription.ts`
- Create: `nodes/Flagsmith/Flagsmith.node.ts`
- Create: `nodes/Flagsmith/Flagsmith.node.json`

- [ ] **Step 1: Write the Environment description**

`nodes/Flagsmith/descriptions/EnvironmentDescription.ts`:
```ts
import { INodeProperties } from 'n8n-workflow';

export const environmentOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['environment'] } },
    options: [
      {
        name: 'Get Flags',
        value: 'getFlags',
        action: 'Get all flags for an environment',
        description: 'Evaluate all flags for the environment',
        routing: { request: { method: 'GET', url: '/flags/' } },
      },
    ],
    default: 'getFlags',
  },
];

export const environmentFields: INodeProperties[] = [];
```

- [ ] **Step 2: Write the node with only the Environment resource wired**

`nodes/Flagsmith/Flagsmith.node.ts`:
```ts
import { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { environmentOperations, environmentFields } from './descriptions/EnvironmentDescription';

export class Flagsmith implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Flagsmith',
    name: 'flagsmith',
    icon: 'file:flagsmith.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Read and control Flagsmith feature flags',
    defaults: { name: 'Flagsmith' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'flagsmithAdminApi',
        required: true,
        displayOptions: { show: { resource: ['feature'] } },
      },
      {
        name: 'flagsmithEnvironmentApi',
        required: true,
        displayOptions: { show: { resource: ['identity', 'environment'] } },
      },
    ],
    requestDefaults: {
      baseURL: '={{$credentials.baseUrl}}',
      headers: { 'Content-Type': 'application/json' },
    },
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Environment', value: 'environment' },
          { name: 'Feature', value: 'feature' },
          { name: 'Identity', value: 'identity' },
        ],
        default: 'environment',
      },
      ...environmentOperations,
      ...environmentFields,
    ],
  };
}
```

- [ ] **Step 3: Add the codex metadata file**

`nodes/Flagsmith/Flagsmith.node.json`:
```json
{
  "node": "n8n-nodes-flagsmith.flagsmith",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Development", "Utility"],
  "resources": {
    "credentialDocumentation": [
      { "url": "https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview" }
    ],
    "primaryDocumentation": [
      { "url": "https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview" }
    ]
  }
}
```

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint`
Expected: compiles; lint clean. Fix any `eslint-plugin-n8n-nodes-base` issues (common: node `description` must end without a period; options sorted alphabetically; `requestDefaults` present).

- [ ] **Step 5: Commit**

```bash
git add nodes/Flagsmith && git commit -m "feat: add Flagsmith action node with Get Flags"
```

---

## Task 8: Action node — Identity resource (Get Identity Flags, Set Trait)

**Files:**
- Create: `nodes/Flagsmith/descriptions/IdentityDescription.ts`
- Modify: `nodes/Flagsmith/Flagsmith.node.ts`

- [ ] **Step 1: Write the Identity description with both operations**

`nodes/Flagsmith/descriptions/IdentityDescription.ts`:
```ts
import {
  IExecuteSingleFunctions,
  IHttpRequestOptions,
  INodeProperties,
} from 'n8n-workflow';
import { buildTraits, TraitsCollection } from '../../shared/traits';

export async function buildSetTraitBody(
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
  const identifier = this.getNodeParameter('identifier') as string;
  const traitsParam = this.getNodeParameter('traits', {}) as TraitsCollection;
  requestOptions.body = { identifier, traits: buildTraits(traitsParam) };
  return requestOptions;
}

export const identityOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['identity'] } },
    options: [
      {
        name: 'Get Identity Flags',
        value: 'getIdentityFlags',
        action: 'Get flags and traits for an identity',
        description: 'Evaluate flags and traits for a specific identity',
        routing: {
          request: {
            method: 'GET',
            url: '/identities/',
            qs: { identifier: '={{$parameter.identifier}}' },
          },
        },
      },
      {
        name: 'Set Trait',
        value: 'setTrait',
        action: 'Set traits on an identity',
        description: 'Write one or more traits on an identity and re-evaluate segments',
        routing: {
          request: { method: 'POST', url: '/identities/' },
          send: { preSend: [buildSetTraitBody] },
        },
      },
    ],
    default: 'getIdentityFlags',
  },
];

export const identityFields: INodeProperties[] = [
  {
    displayName: 'Identifier',
    name: 'identifier',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['identity'] } },
    description: 'The identity identifier (e.g. a user id or email)',
  },
  {
    displayName: 'Traits',
    name: 'traits',
    type: 'fixedCollection',
    typeOptions: { multipleValues: true },
    default: {},
    displayOptions: { show: { resource: ['identity'], operation: ['setTrait'] } },
    options: [
      {
        name: 'trait',
        displayName: 'Trait',
        values: [
          { displayName: 'Key', name: 'key', type: 'string', default: '' },
          { displayName: 'Value', name: 'value', type: 'string', default: '' },
        ],
      },
    ],
  },
];
```

- [ ] **Step 2: Wire the Identity description into the node**

In `nodes/Flagsmith/Flagsmith.node.ts`, add the import and spread the new properties after the Environment ones:
```ts
import { identityOperations, identityFields } from './descriptions/IdentityDescription';
```
Update the `properties` array tail to:
```ts
      ...environmentOperations,
      ...environmentFields,
      ...identityOperations,
      ...identityFields,
```

- [ ] **Step 3: Build and lint**

Run: `npm run build && npm run lint`
Expected: compiles; lint clean.

- [ ] **Step 4: Run the unit suite (helpers still green)**

Run: `npm test`
Expected: all helper tests PASS (traits builder is now consumed by `buildSetTraitBody`).

- [ ] **Step 5: Commit**

```bash
git add nodes/Flagsmith && git commit -m "feat: add Identity resource (get flags, set trait)"
```

---

## Task 9: Action node — Feature resource (Update Feature State + loadOptions)

**Files:**
- Create: `nodes/Flagsmith/descriptions/FeatureDescription.ts`
- Create: `nodes/Flagsmith/methods/loadOptions.ts`
- Modify: `nodes/Flagsmith/Flagsmith.node.ts`

- [ ] **Step 1: Write the loadOptions method**

`nodes/Flagsmith/methods/loadOptions.ts`:
```ts
import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { mapFeatureStatesToOptions, FeatureState } from '../../shared/featureStates';

export async function getFeatureStates(
  this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
  const environment = this.getNodeParameter('environment') as string;
  const credentials = await this.getCredentials('flagsmithAdminApi');
  const response = (await this.helpers.httpRequestWithAuthentication.call(
    this,
    'flagsmithAdminApi',
    {
      method: 'GET',
      url: `${credentials.baseUrl}/environments/${environment}/featurestates/`,
    },
  )) as FeatureState[];
  return mapFeatureStatesToOptions(response);
}
```
Note: if the Admin API paginates featurestates (`{count, results}`), unwrap `response.results` before mapping — verify against the sandbox in Task 13 and adjust the mapper input accordingly.

- [ ] **Step 2: Write the Feature description**

`nodes/Flagsmith/descriptions/FeatureDescription.ts`:
```ts
import {
  IExecuteSingleFunctions,
  IHttpRequestOptions,
  INodeProperties,
} from 'n8n-workflow';

export async function buildUpdateFeatureStateBody(
  this: IExecuteSingleFunctions,
  requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
  const body: Record<string, unknown> = {};
  const enabled = this.getNodeParameter('enabled', null);
  const value = this.getNodeParameter('featureStateValue', null);
  if (enabled !== null && enabled !== undefined) body.enabled = enabled;
  if (value !== null && value !== undefined && value !== '') {
    body.feature_state_value = value;
  }
  requestOptions.body = body;
  return requestOptions;
}

export const featureOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'operation',
    type: 'options',
    noDataExpression: true,
    displayOptions: { show: { resource: ['feature'] } },
    options: [
      {
        name: 'Update Feature State',
        value: 'updateFeatureState',
        action: 'Update a feature state in an environment',
        description: 'Set enabled and/or value for a flag in an environment',
        routing: {
          request: {
            method: 'PATCH',
            url: '=/environments/{{$parameter.environment}}/featurestates/{{$parameter.featureStateId}}/',
          },
          send: { preSend: [buildUpdateFeatureStateBody] },
        },
      },
    ],
    default: 'updateFeatureState',
  },
];

export const featureFields: INodeProperties[] = [
  {
    displayName: 'Environment Key',
    name: 'environment',
    type: 'string',
    required: true,
    default: '',
    displayOptions: { show: { resource: ['feature'] } },
    description: 'The environment api_key to target',
  },
  {
    displayName: 'Feature Name or ID',
    name: 'featureStateId',
    type: 'options',
    required: true,
    default: '',
    typeOptions: { loadOptionsMethod: 'getFeatureStates', loadOptionsDependsOn: ['environment'] },
    displayOptions: { show: { resource: ['feature'] } },
    description:
      'Choose a feature from the list. The value resolved is the environment-specific feature-state id. Choose from the list, or specify an ID using an expression.',
  },
  {
    displayName: 'Enabled',
    name: 'enabled',
    type: 'boolean',
    default: false,
    displayOptions: { show: { resource: ['feature'], operation: ['updateFeatureState'] } },
    description: 'Whether the flag is enabled in this environment',
  },
  {
    displayName: 'Value',
    name: 'featureStateValue',
    type: 'string',
    default: '',
    displayOptions: { show: { resource: ['feature'], operation: ['updateFeatureState'] } },
    description: 'Optional feature state value to set. Leave blank to leave unchanged.',
  },
];
```
Note: the `enabled` boolean always has a value (default `false`), so it is always sent. That matches the kill-switch use case. If "leave enabled unchanged" becomes a requirement, convert `enabled` to an `options` field with Unchanged/On/Off — out of scope for v1.

- [ ] **Step 3: Register loadOptions and Feature properties in the node**

In `nodes/Flagsmith/Flagsmith.node.ts`:
```ts
import { featureOperations, featureFields } from './descriptions/FeatureDescription';
import { getFeatureStates } from './methods/loadOptions';
```
Add to the class body (after `description`):
```ts
  methods = { loadOptions: { getFeatureStates } };
```
Append to `properties`:
```ts
      ...featureOperations,
      ...featureFields,
```

- [ ] **Step 4: Build and lint**

Run: `npm run build && npm run lint`
Expected: compiles; lint clean. The `Feature Name or ID` displayName + "Choose from the list, or specify an ID using an expression." description satisfy the n8n lint rule for `loadOptions` fields.

- [ ] **Step 5: Run unit suite**

Run: `npm test`
Expected: all helper tests PASS (`mapFeatureStatesToOptions` now consumed by loadOptions).

- [ ] **Step 6: Commit**

```bash
git add nodes/Flagsmith && git commit -m "feat: add Feature resource (update feature state)"
```

---

## Task 10: Trigger node (programmatic webhook)

**Files:**
- Create: `nodes/FlagsmithTrigger/FlagsmithTrigger.node.ts`
- Create: `nodes/FlagsmithTrigger/FlagsmithTrigger.node.json`

- [ ] **Step 1: Write the trigger node**

`nodes/FlagsmithTrigger/FlagsmithTrigger.node.ts`:
```ts
import {
  IHookFunctions,
  IWebhookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookResponseData,
  NodeApiError,
} from 'n8n-workflow';
import { isValidSignature } from '../shared/signature';
import { passesFeatureFilter } from '../shared/filter';

export class FlagsmithTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Flagsmith Trigger',
    name: 'flagsmithTrigger',
    icon: 'file:flagsmith.svg',
    group: ['trigger'],
    version: 1,
    description: 'Starts the workflow when a Flagsmith flag changes',
    defaults: { name: 'Flagsmith Trigger' },
    inputs: [],
    outputs: ['main'],
    credentials: [{ name: 'flagsmithAdminApi', required: true }],
    webhooks: [
      { name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' },
    ],
    properties: [
      {
        displayName: 'Environment Key',
        name: 'environment',
        type: 'string',
        required: true,
        default: '',
        description: 'The environment api_key to watch',
      },
      {
        displayName: 'Feature Names',
        name: 'featureNames',
        type: 'string',
        default: '',
        description:
          'Optional comma-separated feature names. If set, the trigger only fires for these features.',
      },
    ],
  };

  webhookMethods = {
    default: {
      async checkExists(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        return Boolean(webhookData.webhookId);
      },

      async create(this: IHookFunctions): Promise<boolean> {
        const webhookUrl = this.getNodeWebhookUrl('default') as string;
        const environment = this.getNodeParameter('environment') as string;
        const credentials = await this.getCredentials('flagsmithAdminApi');
        const secret = Buffer.from(`${Date.now()}-${webhookUrl}`).toString('base64');
        const response = (await this.helpers.httpRequestWithAuthentication.call(
          this,
          'flagsmithAdminApi',
          {
            method: 'POST',
            url: `${credentials.baseUrl}/environments/${environment}/webhooks/`,
            body: { url: webhookUrl, enabled: true, secret },
          },
        )) as { id: number };
        const webhookData = this.getWorkflowStaticData('node');
        webhookData.webhookId = response.id;
        webhookData.secret = secret;
        return true;
      },

      async delete(this: IHookFunctions): Promise<boolean> {
        const webhookData = this.getWorkflowStaticData('node');
        if (!webhookData.webhookId) return true;
        const environment = this.getNodeParameter('environment') as string;
        const credentials = await this.getCredentials('flagsmithAdminApi');
        try {
          await this.helpers.httpRequestWithAuthentication.call(this, 'flagsmithAdminApi', {
            method: 'DELETE',
            url: `${credentials.baseUrl}/environments/${environment}/webhooks/${webhookData.webhookId}/`,
          });
        } catch (error) {
          return false;
        }
        delete webhookData.webhookId;
        delete webhookData.secret;
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const webhookData = this.getWorkflowStaticData('node');
    const secret = webhookData.secret as string | undefined;
    const req = this.getRequestObject();
    const headerData = this.getHeaderData() as Record<string, string>;
    const signature = headerData['x-flagsmith-signature'];

    // rawBody is needed for HMAC. n8n populates req.rawBody for webhook requests.
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody?.toString('utf8') ??
      JSON.stringify(this.getBodyData());

    if (secret) {
      if (!isValidSignature(rawBody, signature, secret)) {
        const res = this.getResponseObject();
        res.status(401).send('Invalid signature');
        return { noWebhookResponse: true };
      }
    }

    const body = this.getBodyData() as Record<string, unknown>;
    const featureNamesRaw = this.getNodeParameter('featureNames', '') as string;
    const featureNames = featureNamesRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!passesFeatureFilter(body, featureNames)) {
      return { noWebhookResponse: false, workflowData: [] };
    }

    return { workflowData: [this.helpers.returnJsonArray([body])] };
  }
}
```
Note (verify in Task 13): the raw-body acquisition for HMAC. n8n typically exposes the raw body on the request object for webhook nodes; confirm `req.rawBody` is populated. If it is not, set the webhook to receive raw bytes (some n8n versions require `responseMode`/binary handling) and re-verify. The `JSON.stringify(getBodyData())` fallback will NOT match Flagsmith's HMAC because key order/whitespace differ — it exists only so the node degrades to "accept" rather than crash when no secret is set; never rely on it for signed verification.

- [ ] **Step 2: Add codex metadata**

`nodes/FlagsmithTrigger/FlagsmithTrigger.node.json`:
```json
{
  "node": "n8n-nodes-flagsmith.flagsmithTrigger",
  "nodeVersion": "1.0",
  "codexVersion": "1.0",
  "categories": ["Development", "Utility"],
  "resources": {
    "primaryDocumentation": [
      { "url": "https://docs.flagsmith.com/system-administration/webhooks" }
    ]
  }
}
```

- [ ] **Step 3: Build and lint**

Run: `npm run build && npm run lint`
Expected: compiles; lint clean. Fix trigger-specific lint rules (group must be `['trigger']`; node name ends in `Trigger`; no `requestDefaults` needed).

- [ ] **Step 4: Run unit suite**

Run: `npm test`
Expected: signature + filter tests PASS (both now consumed by the trigger).

- [ ] **Step 5: Commit**

```bash
git add nodes/FlagsmithTrigger && git commit -m "feat: add Flagsmith Trigger webhook node"
```

---

## Task 11: README and package docs

**Files:**
- Create/Modify: `README.md`

- [ ] **Step 1: Write the README**

Cover: install (community node name `n8n-nodes-flagsmith`), the two credentials and where to get each token (Admin = Organisation Settings → API Keys; Environment = per-environment client-side key), each of the 4 operations with a one-line use case, the trigger and the self-host tunnel requirement, and the self-hosted base-URL override. Include the kill-switch and CRM-trait hero examples. No em-dashes in prose (use commas).

- [ ] **Step 2: Commit**

```bash
git add README.md && git commit -m "docs: add README"
```

---

## Task 12: CI publish workflow with provenance

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Write the workflow**

`.github/workflows/publish.yml`:
```yaml
name: Publish
on:
  release:
    types: [published]
permissions:
  contents: read
  id-token: write   # required for npm provenance
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```
Note: requires `@n8n/node-cli` >= 0.23.0 and an npm Trusted Publisher / `NPM_TOKEN` configured on the Flagsmith-org npm account. This is the path that satisfies the post-1-May-2026 verified-node requirement (CI publish with provenance). Local `npm publish` will not be accepted for verification.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish.yml && git commit -m "ci: add npm publish workflow with provenance"
```

---

## Task 13: Manual end-to-end verification against the sandbox

Requires from the owner: an Admin org API token, one environment key, the project/environment names, and a reachable n8n (local + tunnel, or hosted). This task is checklist-driven, not TDD.

- [ ] **Step 1: Link the package into a local n8n**

Run: `npm run dev`
Expected: a local n8n starts with the Flagsmith nodes loaded (hot reload). If the scaffold lacks `dev`, use `npm link` into a local n8n install.

- [ ] **Step 2: Configure both credentials in n8n**

Enter the Admin org token and the environment key. Click "Test" on each; expected: both credential tests pass (`/projects/` and `/flags/` return 200).

- [ ] **Step 3: Exercise Get Flags**

Add a Flagsmith node, Resource = Environment, Operation = Get Flags, run. Expected: array of flag objects from the sandbox environment.

- [ ] **Step 4: Exercise Get Identity Flags and Set Trait**

Get Identity Flags for a test identifier (expected `{flags, traits}`). Then Set Trait with `plan=enterprise`, run, and re-run Get Identity Flags. Expected: the trait appears and any segment-gated flags re-evaluate.

- [ ] **Step 5: Exercise Update Feature State**

Resource = Feature, enter the environment api_key, open the Feature dropdown (expected: it populates with feature names via loadOptions), pick one, set Enabled, run. Expected: 200 and the flag toggles in the Flagsmith dashboard. Confirm whether the featurestates list is paginated and adjust `loadOptions.ts` per the Task 9 note if so.

- [ ] **Step 6: Exercise the Trigger end to end**

Activate a workflow with the Flagsmith Trigger (environment api_key set). Expected: a webhook appears in the Flagsmith environment settings (auto-registered). Toggle a flag in the dashboard; expected: the workflow fires and `X-Flagsmith-Signature` verification passes. Confirm `req.rawBody` is populated (Task 10 note); if signature verification fails on a known-good event, fix the raw-body acquisition and re-test. Deactivate the workflow; expected: the webhook is removed from Flagsmith.

- [ ] **Step 7: Record results and commit any fixes**

Commit any adjustments (pagination unwrap, raw-body handling) with clear messages. Tag the verified state: `git commit -m "fix: address e2e findings"` as needed.

---

## Task 14: Prepare verification submission

- [ ] **Step 1: Pre-submission gut check**

Confirm scope is flag operations only (no overlap with n8n paid/enterprise features). Confirm: MIT license, `n8n-community-node-package` keyword, no runtime dependencies (`npm ls --prod --depth=0` shows none beyond n8n peers), README present, lint clean.

- [ ] **Step 2: Cut a release to trigger the provenance publish**

Create a GitHub release; expected: the publish workflow runs and `n8n-nodes-flagsmith` appears on npm with a provenance statement.

- [ ] **Step 3: Submit via the n8n Creator Portal**

Submit the package for vetting. Record the submission reference.

---

## Self-review notes

- **Spec coverage:** package shape (T1), both credentials with overridable base URLs (T2), Get Flags (T7), Get Identity Flags + Set Trait (T8), Update Feature State + loadOptions resolution (T9), Trigger with auto-register/delete + signature verify + feature filter (T10, helpers in T3/T6), error handling via Continue-on-Fail + 401 on bad signature (T10; Continue-on-Fail is an n8n node-level toggle, no code needed), README (T11), provenance CI (T12), e2e (T13), verification submission (T14). Create Feature is intentionally absent (cut from v1).
- **Known verify-points flagged inline:** featurestates pagination (T9/T13), webhook raw-body acquisition for HMAC (T10/T13), `$credentials.baseUrl` resolving correctly per active credential (validated by credential tests in T13 Step 2).
- **Type consistency:** `flagsmithAdminApi` / `flagsmithEnvironmentApi` credential names, `environment` (api_key) param, `featureStateId` (loadOptions value = feature-state id), `buildTraits`/`mapFeatureStatesToOptions`/`isValidSignature`/`passesFeatureFilter` helper signatures are consistent across tasks.
