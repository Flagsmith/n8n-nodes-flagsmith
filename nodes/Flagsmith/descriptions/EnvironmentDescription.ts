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
				description: 'Evaluate all flags for the environment',
				routing: { request: { method: 'GET', url: '/flags/' } },
			},
		],
		default: 'getFlags',
	},
];

export const environmentFields: INodeProperties[] = [];
