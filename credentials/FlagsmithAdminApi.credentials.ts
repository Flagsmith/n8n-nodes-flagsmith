import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class FlagsmithAdminApi implements ICredentialType {
	name = 'flagsmithAdminApi';
	displayName = 'Flagsmith Admin API';
	icon: Icon = 'file:../icons/flagsmith.svg';
	documentationUrl =
		'https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/admin-api';
	properties: INodeProperties[] = [
		{
			displayName: 'Organisation API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.flagsmith.com/api/v1',
			description: 'Override for self-hosted or Private Cloud instances',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { Authorization: '=Api-Key {{$credentials.apiToken}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: { baseURL: '={{$credentials.baseUrl}}', url: '/projects/' },
	};
}
