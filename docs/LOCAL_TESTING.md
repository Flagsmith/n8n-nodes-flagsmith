# Local testing guide

How to run `n8n-nodes-flagsmith` in a local self-hosted n8n and exercise every operation plus the trigger end to end, before publishing.

You will need a Flagsmith account (SaaS or self-hosted) with a test project and environment, and Node.js 22+.

## What you need from Flagsmith

| Value | Where to get it |
|---|---|
| Organisation API token | Flagsmith dashboard, Organisation Settings, API Keys tab |
| Admin base URL | `https://api.flagsmith.com/api/v1` (SaaS default; use your host if self-hosted) |
| Environment key | Your environment's client-side key (Environment Settings) |
| Edge base URL | `https://edge.api.flagsmith.com/api/v1` (SaaS default) |

Create at least one feature flag in your test environment to exercise the operations against.

## 1. Build and install the node

```bash
# From the cloned repo
npm install
npm run build && npm run lint && npm test    # build ok, lint clean, tests pass

# Install into n8n's community-nodes directory
cd ~/.n8n/nodes && npm install /absolute/path/to/n8n-nodes-flagsmith
```

## 2. Run n8n

For the action operations, a plain local instance is enough:

```bash
n8n start
```

The **trigger** additionally needs n8n to be reachable from the public internet, because Flagsmith POSTs webhook events to it and rejects internal or private addresses (such as localhost). For local development, expose n8n with a tunnel and point n8n at it:

```bash
# e.g. ngrok http 5678  ->  https://<your-tunnel>.ngrok-free.dev
WEBHOOK_URL="https://<your-tunnel>.ngrok-free.dev" n8n start
```

If you restart the tunnel the URL changes, so update `WEBHOOK_URL` to match.

## 3. Confirm the node loaded

Open http://localhost:5678. In a new workflow, click **+** and search "Flagsmith". You should see two nodes: **Flagsmith** and **Flagsmith Trigger**. If they are missing, restart n8n so it loads the community package.

## 4. Create the two credentials

In **Credentials, Add credential**:

1. **Flagsmith Admin API**: paste your organisation API token, leave the base URL default. If an "Allowed HTTP Request Domains" setting appears, allow all (the node only calls the Flagsmith API).
2. **Flagsmith Environment Key**: paste your environment key, leave the base URL default.

## 5. Test the four action operations

Build one workflow: **Manual Trigger, then Flagsmith**. For each operation set the fields, click **Execute step**, and inspect the output.

1. **Get Flags**: Resource `Environment`, Operation `Get Flags`, credential = Environment Key. Returns all flags for the environment.
2. **Get Identity Flags**: Resource `Identity`, Operation `Get Identity Flags`, Identifier `test-user`, credential = Environment Key. Returns `{ flags, traits }` for that identity.
3. **Set Trait**: Resource `Identity`, Operation `Set Trait`, Identifier `test-user`, add a Trait (for example `plan` = `enterprise`), credential = Environment Key. Re-run Get Identity Flags to confirm the trait persisted and any segment-gated flags re-evaluated.
4. **Update Feature State**: Resource `Feature`, Operation `Update Feature State`, enter your **Environment Key**, then open the **Feature** dropdown. It should populate with your flags by name (this exercises the dynamic lookup). Pick one, set **Enabled State** to `Enable`, optionally set a **Value**, and Execute. Confirm the change in the Flagsmith dashboard, then set **Enabled State** to `Disable` to restore.

Note: a successful Update Feature State returns `feature_state_value: null` in its response even though the write persists. Confirm the result in the Flagsmith dashboard rather than relying on the response body.

## 6. Test the trigger end to end

Requires the public `WEBHOOK_URL` from step 2.

1. New workflow, add **Flagsmith Trigger**, credential = **Admin API**, enter your **Environment Key**, leave Feature Names blank (or list specific feature names to filter).
2. Click **Listen for test event**. n8n registers a webhook in Flagsmith via your public URL. You can confirm it under the environment's Webhooks settings.
3. In the Flagsmith dashboard, toggle a flag in that environment.
4. Within a second or two the editor captures the event: `event_type: FLAG_UPDATED` with `data.new_state` showing the new flag state. A captured event means the callback arrived and the `X-Flagsmith-Signature` HMAC verified (forged or unsigned requests are rejected with 401).
5. Stop listening or deactivate the workflow, then confirm the webhook was removed from Flagsmith. The node deregisters it automatically.

## 7. Clean up

Delete any test workflows and credentials you do not want to keep, and restore any flag you toggled to its original state.
