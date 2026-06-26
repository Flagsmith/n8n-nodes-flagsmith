import { IExecuteSingleFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';
import { experimentsBaseUrl } from '../../shared/features';

export async function buildUpdateFlagBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const credentials = await this.getCredentials('flagsmithAdminApi');
	const environment = this.getNodeParameter('environment') as string;
	const featureId = this.getNodeParameter('featureId') as number;
	const enabled = this.getNodeParameter('enabled') as boolean;
	const valueType = this.getNodeParameter('valueType') as string;
	const value = this.getNodeParameter('value', '') as string;

	// update-flag-v2 lives under /api/experiments (not /api/v1) and works the same
	// whether or not the environment has Feature Versioning enabled. It declares
	// the full environment-default state, so enabled and value are always sent.
	requestOptions.baseURL = experimentsBaseUrl(credentials.baseUrl as string);
	requestOptions.url = `/environments/${environment}/update-flag-v2/`;
	requestOptions.body = {
		feature: { id: Number(featureId) },
		environment_default: {
			enabled,
			value: { type: valueType, value: String(value ?? '') },
		},
	};
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
				description: 'Set the enabled state and value of a flag in an environment',
				routing: {
					request: {
						method: 'POST',
						url: '=/environments/{{$parameter.environment}}/update-flag-v2/',
					},
					send: { preSend: [buildUpdateFlagBody] },
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
		name: 'featureId',
		type: 'options',
		required: true,
		default: '',
		typeOptions: { loadOptionsMethod: 'getFeatures', loadOptionsDependsOn: ['environment'] },
		displayOptions: { show: { resource: ['feature'] } },
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Enabled',
		name: 'enabled',
		type: 'boolean',
		default: false,
		displayOptions: { show: { resource: ['feature'], operation: ['updateFeatureState'] } },
		description:
			'Whether the flag is enabled in this environment. This endpoint sets the full state, so it is always applied.',
	},
	{
		displayName: 'Value Type',
		name: 'valueType',
		type: 'options',
		default: 'string',
		options: [
			{ name: 'Boolean', value: 'boolean' },
			{ name: 'Integer', value: 'integer' },
			{ name: 'String', value: 'string' },
		],
		displayOptions: { show: { resource: ['feature'], operation: ['updateFeatureState'] } },
		description: 'The type of the feature value to set',
	},
	{
		displayName: 'Value',
		name: 'value',
		type: 'string',
		default: '',
		displayOptions: { show: { resource: ['feature'], operation: ['updateFeatureState'] } },
		description:
			'The feature value, sent as a string. For Boolean use "true" or "false"; for Integer use a number. This endpoint always sets the value.',
	},
];
