import {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INodeProperties,
} from 'n8n-workflow';
import { buildTraits, TraitsCollection } from '../../shared/traits';

export async function buildSetTraitBody(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const identifier = this.getNodeParameter('identifier') as string;
	const traitsParam = this.getNodeParameter('traits', {}) as TraitsCollection;
	requestOptions.body = { identifier, traits: buildTraits(traitsParam) };
	return requestOptions;
}

export const identityOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['identity'] } },
		options: [
			{
				name: 'Get Identity Flags',
				value: 'getIdentityFlags',
				action: 'Get flags and traits for an identity',
				description: 'Evaluate flags and traits for a specific identity',
				routing: {
					request: {
						method: 'POST',
						url: '/identities/',
						body: { identifier: '={{$parameter.identifier}}' },
					},
				},
			},
			{
				name: 'Set Trait',
				value: 'setTrait',
				action: 'Set traits on an identity',
				description: 'Write one or more traits on an identity and re-evaluate segments',
				routing: {
					request: { method: 'POST', url: '/identities/' },
					send: { preSend: [buildSetTraitBody] },
				},
			},
		],
		default: 'getIdentityFlags',
	},
];

export const identityFields: INodeProperties[] = [
	{
		displayName: 'Identifier',
		name: 'identifier',
		type: 'string',
		required: true,
		default: '',
		displayOptions: { show: { resource: ['identity'] } },
		description: 'The identity identifier (e.g. a user ID or email)',
	},
	{
		displayName: 'Traits',
		name: 'traits',
		type: 'fixedCollection',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: { show: { resource: ['identity'], operation: ['setTrait'] } },
		options: [
			{
				name: 'trait',
				displayName: 'Trait',
				values: [
					{ displayName: 'Key', name: 'key', type: 'string', default: '' },
					{ displayName: 'Value', name: 'value', type: 'string', default: '' },
				],
			},
		],
	},
];
