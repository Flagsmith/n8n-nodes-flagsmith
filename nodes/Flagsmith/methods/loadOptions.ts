import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { mapFeaturesToOptions, Feature } from '../../shared/featureStates';

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
	// No environment yet: return an empty dropdown rather than hitting the API
	if (!environment) return [];
	const credentials = await this.getCredentials('flagsmithAdminApi');
	const baseUrl = credentials.baseUrl as string;

	// The environment is identified by its api_key in the URL; we need its numeric
	// id (for the features query) and its project (for the features endpoint path).
	const environmentDetail = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{ method: 'GET', url: `${baseUrl}/environments/${environment}/` },
	)) as { id: number; project: number };

	// Querying features with `environment` attaches each feature's environment
	// feature state inline, so a single call yields both the feature name and the
	// feature-state id we PATCH — no separate featurestates call or join needed.
	const featuresResponse = await this.helpers.httpRequestWithAuthentication.call(
		this,
		'flagsmithAdminApi',
		{
			method: 'GET',
			url: `${baseUrl}/projects/${environmentDetail.project}/features/`,
			qs: { environment: environmentDetail.id },
		},
	);

	const features = unwrap<Feature>(featuresResponse);
	return mapFeaturesToOptions(features);
}
