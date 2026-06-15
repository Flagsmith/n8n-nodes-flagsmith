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
			...featureOperations,
			...featureFields,
			...identityOperations,
			...identityFields,
		],
	};

	methods = { loadOptions: { getFeatureStates } };
}
