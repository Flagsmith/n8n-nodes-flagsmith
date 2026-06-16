import { IExecuteSingleFunctions, IHttpRequestOptions, INodeProperties } from 'n8n-workflow';

export async function buildUpdateFeatureStateBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const body: Record<string, unknown> = {};
	const enabledState = this.getNodeParameter('enabledState', 'unchanged') as string;
	const value = this.getNodeParameter('featureStateValue', null);
	// Only write `enabled` when the user explicitly chose a state, so a value-only
	// update never silently toggles a live flag.
	if (enabledState === 'enable') body.enabled = true;
	else if (enabledState === 'disable') body.enabled = false;
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
				description: 'Set as enabled or define a value for a flag in an environment',
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
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
	{
		displayName: 'Enabled State',
		name: 'enabledState',
		type: 'options',
		default: 'unchanged',
		displayOptions: { show: { resource: ['feature'], operation: ['updateFeatureState'] } },
		options: [
			{ name: 'Disable', value: 'disable' },
			{ name: 'Enable', value: 'enable' },
			{ name: 'Leave Unchanged', value: 'unchanged' },
		],
		description: 'Whether to enable, disable, or leave unchanged the flag in this environment',
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
