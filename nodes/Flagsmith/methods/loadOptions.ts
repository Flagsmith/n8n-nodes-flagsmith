import { ILoadOptionsFunctions, INodePropertyOptions } from 'n8n-workflow';
import { mapFeaturesToOptions, Feature } from '../../shared/features';

// Admin list endpoints paginate as { count, results }; tolerate a bare array too
// (older/self-hosted versions, test doubles).
function unwrap<T>(response: unknown): T[] {
	if (Array.isArray(response)) return response as T[];
	return (response as { results?: T[] }).results ?? [];
}

export async function getFeatures(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const environment = this.getNodeParameter('environment') as string;
	// No environment yet: return an empty dropdown rather than hitting the API
	if (!environment) return [];
	const credentials = await this.getCredentials('flagsmithAdminApi');
	const baseUrl = credentials.baseUrl as string;

	// Features are listed per project; the environment api_key tells us its project.
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

	return mapFeaturesToOptions(unwrap<Feature>(featuresResponse));
}
