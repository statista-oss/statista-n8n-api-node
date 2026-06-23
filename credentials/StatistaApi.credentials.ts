import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class StatistaApi implements ICredentialType {
	name = 'statistaApi';
	displayName = 'Statista API';
	icon = {
		light: 'file:../nodes/StatistaApi/statista.svg',
		dark: 'file:../nodes/StatistaApi/statista.svg',
	} as const;
	documentationUrl = 'https://docs.platform.statista.ai/start/authentication';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Statista API key. Request one at https://platform.statista.ai/join',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.statista.ai/v1',
			url: '/search/statistics',
			method: 'GET',
			qs: { q: 'test', size: 1 },
		},
	};
}
