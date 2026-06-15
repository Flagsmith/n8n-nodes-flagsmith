import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { mapFeatureStatesToOptions, FeatureState } from '../../shared/featureStates';

export async function getFeatureStates(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const environment = this.getNodeParameter('environment') as string;
	const credentials = await this.getCredentials('flagsmithAdminApi');
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{
			method: 'GET',
			url: `${credentials.baseUrl}/environments/${environment}/featurestates/`,
		},
	)) as FeatureState[];
	// TODO: unwrap response.results if paginated (verify against sandbox)
	return mapFeatureStatesToOptions(response);
}
