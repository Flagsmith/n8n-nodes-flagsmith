import { INodeProperties } from 'n8n-workflow';

export const environmentOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['environment'] } },
		options: [
			{
				name: 'Get Flags',
				value: 'getFlags',
				action: 'Get all flags for an environment',
				description: 'Get the full list of flags and their status in this environment',
				routing: { request: { method: 'GET', url: '/flags/' } },
			},
		],
		default: 'getFlags',
	},
];

export const environmentFields: INodeProperties[] = [];
