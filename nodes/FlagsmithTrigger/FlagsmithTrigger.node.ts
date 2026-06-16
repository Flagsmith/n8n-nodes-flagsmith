import {
	Icon,
	IDataObject,
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	JsonObject,
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';
import { randomBytes } from 'crypto';
import { isValidSignature } from '../shared/signature';
import { passesFeatureFilter } from '../shared/filter';

export class FlagsmithTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flagsmith Trigger',
		name: 'flagsmithTrigger',
		icon: 'file:flagsmith.svg' as Icon,
		group: ['trigger'],
		version: 1,
		subtitle: 'on flag change',
		description: 'Starts the workflow when a Flagsmith flag changes',
		defaults: { name: 'Flagsmith Trigger' },
		usableAsTool: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
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
				// 256 bits of CSPRNG entropy: Flagsmith signs each event with this secret,
				// so it must be unguessable or signature verification is worthless.
				const secret = randomBytes(32).toString('hex');
				let response: { id?: number };
				try {
					response = (await this.helpers.httpRequestWithAuthentication.call(
						this,
						'flagsmithAdminApi',
						{
							method: 'POST',
							url: `${credentials.baseUrl}/environments/${environment}/webhooks/`,
							body: { url: webhookUrl, enabled: true, secret },
						},
					)) as { id?: number };
				} catch (error) {
					// Flagsmith refuses to register webhooks that target internal or private
					// addresses (e.g. localhost), so a locally-hosted n8n must be exposed via a
					// public tunnel. Surface that clearly instead of a generic "bad request".
					throw new NodeOperationError(
						this.getNode(),
						`Could not register the Flagsmith webhook for "${webhookUrl}". Please note that Flagsmith must be able to reach this URL and rejects internal or private addresses such as localhost. additional details about the error:`,
						{ description: (error as Error).message },
					);
				}
				if (!response.id) {
					// Registration may have created a webhook in Flagsmith; without the id we
					// cannot clean it up, so fail loudly rather than store an undefined id.
					throw new NodeOperationError(
						this.getNode(),
						`Flagsmith webhook registration returned an unexpected response: ${JSON.stringify(response)}`,
					);
				}
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
					const status = error as {
						httpCode?: number | string;
						statusCode?: number;
						response?: { status?: number };
					};
					const code = Number(status.httpCode ?? status.statusCode ?? status.response?.status);
					// Already gone in Flagsmith: treat as a successful cleanup.
					if (code !== 404) throw new NodeApiError(this.getNode(), error as JsonObject);
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

		// n8n populates req.rawBody (a Buffer) for webhook requests; isValidSignature
		// accepts Buffer directly so we hash the exact bytes Flagsmith signed.
		const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

		if (secret) {
			const bodyForHmac = rawBody ?? JSON.stringify(this.getBodyData());
			if (!isValidSignature(bodyForHmac, signature, secret)) {
				const res = this.getResponseObject();
				res.status(401).send('Invalid signature');
				return { noWebhookResponse: true };
			}
		} else {
			// No stored secret (e.g. static data lost): accept without verification, but
			// make the unsigned path visible rather than silently trusting the caller.
			this.logger?.warn(
				'Flagsmith Trigger: no signing secret stored; accepting webhook without signature verification.',
			);
		}

		const body = this.getBodyData() as IDataObject;
		const featureNamesRaw = this.getNodeParameter('featureNames', '') as string;
		const featureNames = featureNamesRaw
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);

		if (!passesFeatureFilter(body, featureNames)) {
			return { workflowData: [] };
		}

		return { workflowData: [this.helpers.returnJsonArray([body])] };
	}
}
