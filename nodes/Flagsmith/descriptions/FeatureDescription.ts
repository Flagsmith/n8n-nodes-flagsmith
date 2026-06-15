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
		description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
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
