import {
	Icon,
	IDataObject,
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeConnectionTypes,
} from 'n8n-workflow';
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
				} catch {
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
