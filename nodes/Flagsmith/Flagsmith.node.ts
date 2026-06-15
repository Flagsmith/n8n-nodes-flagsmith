import { Icon, INodeType, INodeTypeDescription, NodeConnectionTypes } from 'n8n-workflow';
import { environmentOperations, environmentFields } from './descriptions/EnvironmentDescription';
import { identityOperations, identityFields } from './descriptions/IdentityDescription';
import { featureOperations, featureFields } from './descriptions/FeatureDescription';
import { getFeatureStates } from './methods/loadOptions';

export class Flagsmith implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Flagsmith',
		name: 'flagsmith',
		icon: 'file:flagsmith.svg' as Icon,
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and control Flagsmith feature flags',
		defaults: { name: 'Flagsmith' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [
			{
				name: 'flagsmithAdminApi',
				required: true,
				displayOptions: { show: { authentication: ['adminApi'] } },
			},
			{
				name: 'flagsmithEnvironmentApi',
				required: true,
				displayOptions: { show: { authentication: ['environmentApi'] } },
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
			// n8n's routing engine selects among multiple credentials by an `authentication`
			// parameter. We drive it automatically from the resource (hidden from the user)
			// so the correct credential is used without the user having to know which API
			// backs an operation. Feature ops use the Admin API; Identity/Environment ops
			// use the Environment (Flags) API.
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'hidden',
				default: 'adminApi',
				displayOptions: { show: { resource: ['feature'] } },
			},
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'hidden',
				default: 'environmentApi',
				displayOptions: { show: { resource: ['identity', 'environment'] } },
			},
			...environmentOperations,
			...environmentFields,
			...featureOperations,
			...featureFields,
			...identityOperations,
			...identityFields,
		],
	};

	methods = { loadOptions: { getFeatureStates } };
}
