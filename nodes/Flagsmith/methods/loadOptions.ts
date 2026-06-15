import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { mapFeatureStatesToOptions, FeatureState } from '../../shared/featureStates';

export async function getFeatureStates(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const environment = this.getNodeParameter('environment') as string;
	// No environment yet: return an empty dropdown rather than hitting /environments//featurestates/.
	if (!environment) return [];
	const credentials = await this.getCredentials('flagsmithAdminApi');
	const response = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{
			method: 'GET',
			url: `${credentials.baseUrl}/environments/${environment}/featurestates/`,
		},
	);
	// Flagsmith's Admin list endpoints paginate as { count, results }, but a bare
	// array is also tolerated (older/self-hosted versions, test doubles).
	const paginated = response as { results?: FeatureState[] } | FeatureState[];
	const states = Array.isArray(paginated) ? paginated : (paginated.results ?? []);
	return mapFeatureStatesToOptions(states);
}
