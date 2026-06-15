# n8n-nodes-flagsmith

An n8n community node that lets you read and control [Flagsmith](https://flagsmith.com) feature flags directly in your workflows, and trigger workflows automatically when a flag changes. Use it to build flag-driven automation: kill-switch responses, CRM-to-segment pipelines, or Slack alerts on every flag change.

[Installation](#installation)
[Credentials](#credentials)
[Operations](#operations)
[Trigger](#trigger)
[Compatibility](#compatibility)
[Resources](#resources)

---

## Installation

Search for **`n8n-nodes-flagsmith`** in the n8n community nodes panel.

Full step-by-step instructions are in the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/).

Verified installs from the n8n Cloud canvas and from self-hosted n8n instances both work.

---

## Credentials

The package ships two credential types. Both expose an optional **Base URL** field so you can point the node at a self-hosted Flagsmith instance or a Private Cloud endpoint instead of the Flagsmith SaaS defaults.

### Flagsmith Admin API Key

Used by **Update Feature State** (writing a flag's state in an environment) and by the **Flagsmith Trigger** node, which registers and verifies environment webhooks through the Admin API.

Where to get it: Flagsmith dashboard, **Organisation Settings** (top-right avatar menu), then the **API Keys** tab. Create a new key scoped to your organisation. This key is org-wide and should be treated as a secret.

Default Base URL: `https://api.flagsmith.com/api/v1`

### Flagsmith Environment API Key

Used by the flag-evaluation operations: **Get Flags**, **Get Identity Flags**, and **Set Trait**.

Where to get it: Flagsmith dashboard, open your **Environment** (e.g. Production), then **Environment Settings** at the bottom of the left sidebar. The client-side environment key is shown on that page. It is per-environment and scoped to one environment only.

Default Base URL: `https://edge.api.flagsmith.com/api/v1`

---

## Operations

The **Flagsmith** action node supports four operations across three resources.

### Environment resource

**Get Flags** (resource: Environment)

Fetches every feature flag and remote config value for a given environment. Use this as a branch-on-state read, for example: check a flag at the start of a workflow and route to different branches depending on whether it is enabled.

### Identity resource

**Get Identity Flags** (resource: Identity)

Evaluates all flags and traits for a specific identity (user or device). Answers the question "is this feature on for this customer?" and returns any per-identity trait values alongside it. Useful in CRM or support workflows where you need flag state in the context of a single user.

**Set Trait** (resource: Identity)

Writes one or more traits onto an identity. Flagsmith re-evaluates all segment rules immediately, so any flag that is gated on a segment will flip the moment the trait changes.

Hero example: a deal closes in your CRM and an automation fires, calling Set Trait with `plan=enterprise` for that customer's identity. Every feature gated on the "Enterprise" segment enables automatically, with no code deploy needed.

### Feature resource

**Update Feature State** (resource: Feature)

Sets the enabled state (Enable, Disable, or Leave Unchanged), the value, or both, for a specific flag in a specific environment. The enabled state defaults to Leave Unchanged, so a value-only update never toggles the flag.

Two hero examples:

1. Your monitoring tool fires an alert. The workflow calls Update Feature State to disable a flag instantly, cutting off a broken feature for all users (kill-switch).
2. A configuration row changes in a database. The workflow pushes the new value to Flagsmith so every SDK poll picks up the updated config without a deploy.

---

## Trigger

The **Flagsmith Trigger** node fires a workflow whenever a flag changes in a given environment.

On workflow activation, the node calls the Flagsmith API to register a webhook for the selected environment. On deactivation it removes the webhook. Incoming payloads are verified against the `X-Flagsmith-Signature` header before the workflow continues.

Canonical use: flag changed, post a message to Slack, open a ticket in Jira, or sync the state to an external system.

**Important:** Flagsmith must be able to POST back to your n8n instance. The trigger needs a publicly reachable URL. Flagsmith rejects webhook URLs that target internal or private addresses (such as localhost), so a locally-hosted n8n will fail to activate the trigger until it is exposed publicly. For local development, run n8n behind a tunnel (e.g. ngrok or Cloudflare Tunnel) and set the n8n webhook base URL to the tunnel address.

---

## Compatibility

Requires n8n 1.60.0 or later.

---

## Resources

- [Flagsmith documentation](https://docs.flagsmith.com)
- [Flagsmith REST API overview](https://docs.flagsmith.com/clients/rest)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
