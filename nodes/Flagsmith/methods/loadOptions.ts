import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { mapFeatureStatesToOptions, FeatureState, Feature } from '../../shared/featureStates';

// Admin list endpoints paginate as { count, results }; tolerate a bare array too
// (older/self-hosted versions, test doubles).
function unwrap<T>(response: unknown): T[] {
	if (Array.isArray(response)) return response as T[];
	return (response as { results?: T[] }).results ?? [];
}

export async function getFeatureStates(
	this: ILoadOptionsFunctions,
): Promise<INodePropertyOptions[]> {
	const environment = this.getNodeParameter('environment') as string;
	// No environment yet: empty dropdown rather than hitting /environments//featurestates/.
	if (!environment) return [];
	const credentials = await this.getCredentials('flagsmithAdminApi');
	const baseUrl = credentials.baseUrl as string;

	// The environment tells us its project; the project supplies feature names,
	// which the featurestates list (keyed by feature id) does not include.
	const environmentDetail = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{ method: 'GET', url: `${baseUrl}/environments/${environment}/` },
	)) as { project: number };

	const featuresResponse = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{ method: 'GET', url: `${baseUrl}/projects/${environmentDetail.project}/features/` },
	);

	const statesResponse = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{ method: 'GET', url: `${baseUrl}/environments/${environment}/featurestates/` },
	);

	const features = unwrap<Feature>(featuresResponse);
	const states = unwrap<FeatureState>(statesResponse);
	return mapFeatureStatesToOptions(states, features);
}
