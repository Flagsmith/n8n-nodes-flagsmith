import {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	IN8nHttpFullResponse,
	INodeExecutionData,
	INodeProperties,
	JsonObject,
	NodeApiError,
} from 'n8n-workflow';
import { flagApiBaseUrl } from '../../shared/features';
import {
	classifyFlagWrite,
	serverVersionFrom,
	unsupportedMessage,
	versionUrl,
} from '../../shared/flagWrite';

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

	// The flag API lives under /api/__future__ (not /api/v1) and works the same
	// whether or not the environment has Feature Versioning enabled. This
	// operation declares the environment-default state, so enabled and value are
	// always sent; the PATCH leaves variants and segment overrides untouched.
	requestOptions.baseURL = flagApiBaseUrl(credentials.baseUrl as string);
	requestOptions.url = `/environments/${environment}/features/${Number(featureId)}/`;
	requestOptions.body = {
		environment_default: {
			enabled,
			value: { type: valueType, value: String(value ?? '') },
		},
	};
	return requestOptions;
}

// The request ignores HTTP status errors so that this hook sees the response and
// can explain the failures a user can act on. Every other non-2xx response is
// raised as n8n would have raised it.
export async function handleFlagWriteResponse(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const { statusCode, body } = response;
	const httpCode = String(statusCode);
	switch (classifyFlagWrite(statusCode, body)) {
		case 'ok':
			return items;
		case 'changeRequestsEnabled':
			throw new NodeApiError(this.getNode(), body as JsonObject, {
				httpCode,
				message: 'This environment has change requests enabled, so its flags cannot be updated directly',
				description:
					'Make the change through a change request in Flagsmith, or disable change requests for this environment.',
			});
		case 'unsupported': {
			// Only look the version up on this failure path, to name it in the error.
			// /version/ doesn't need authentication, but the request goes to the
			// configured instance either way.
			const credentials = await this.getCredentials('flagsmithAdminApi');
			let serverVersion: string | undefined;
			try {
				serverVersion = serverVersionFrom(
					await this.helpers.httpRequestWithAuthentication.call(this, 'flagsmithAdminApi', {
						method: 'GET',
						url: versionUrl(credentials.baseUrl as string),
						json: true,
					}),
				);
			} catch {
				serverVersion = undefined;
			}
			throw new NodeApiError(this.getNode(), (body ?? {}) as JsonObject, {
				httpCode,
				message: unsupportedMessage(serverVersion),
				description: 'Upgrade your Flagsmith instance to use this operation.',
			});
		}
		default:
			throw new NodeApiError(this.getNode(), (body ?? {}) as JsonObject, { httpCode });
	}
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
						method: 'PATCH',
						url: '=/environments/{{$parameter.environment}}/features/{{$parameter.featureId}}/',
						ignoreHttpStatusErrors: true,
					},
					send: { preSend: [buildUpdateFlagBody] },
					output: { postReceive: [handleFlagWriteResponse] },
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
