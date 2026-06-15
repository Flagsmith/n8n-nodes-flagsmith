import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class FlagsmithEnvironmentApi implements ICredentialType {
	name = 'flagsmithEnvironmentApi';
	displayName = 'Flagsmith Environment Key API';
	icon: Icon = 'file:flagsmith.svg';
	documentationUrl =
		'https://docs.flagsmith.com/integrating-with-flagsmith/flagsmith-api-overview/flags-api';
	properties: INodeProperties[] = [
		{
			displayName: 'Environment Key',
			name: 'environmentKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Client-side environment key',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://edge.api.flagsmith.com/api/v1',
			description: 'Override for self-hosted or Private Cloud instances',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { 'X-Environment-Key': '={{$credentials.environmentKey}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: { baseURL: '={{$credentials.baseUrl}}', url: '/flags/' },
	};
}
