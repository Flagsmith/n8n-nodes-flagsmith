import { describe, it, expect, vi } from 'vitest';
import type { IExecuteSingleFunctions, IN8nHttpFullResponse } from 'n8n-workflow';
import { handleFlagWriteResponse } from '../nodes/Flagsmith/descriptions/FeatureDescription';

function context(versionResponse: unknown | Error) {
  const httpRequestWithAuthentication = vi.fn(async () => {
    if (versionResponse instanceof Error) throw versionResponse;
    return versionResponse;
  });
  const ctx = {
    getNode: () => ({
      id: '1',
      name: 'Flagsmith',
      type: 'n8n-nodes-flagsmith.flagsmith',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    }),
    getCredentials: async () => ({ baseUrl: 'https://flagsmith.example.com/api/v1' }),
    helpers: { httpRequestWithAuthentication },
  } as unknown as IExecuteSingleFunctions;
  return { ctx, httpRequestWithAuthentication };
}

const response = (statusCode: number, body: unknown) =>
  ({ statusCode, body, headers: {}, statusMessage: '' }) as IN8nHttpFullResponse;

const items = [{ json: { environment_default: { enabled: true } } }];

describe('handleFlagWriteResponse', () => {
  it('returns the items on success without looking up the version', async () => {
    const { ctx, httpRequestWithAuthentication } = context({ image_tag: '2.289.0' });
    await expect(handleFlagWriteResponse.call(ctx, items, response(200, {}))).resolves.toBe(items);
    expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
  });

  it('explains a write refused because change requests are enabled', async () => {
    const { ctx } = context({});
    const body = { detail: 'Cannot make this change…', code: 'change_requests_enabled' };
    await expect(handleFlagWriteResponse.call(ctx, items, response(409, body))).rejects.toThrow(
      /change requests enabled/,
    );
  });

  it('names the instance version when the flag API is missing', async () => {
    const { ctx, httpRequestWithAuthentication } = context({ image_tag: '2.250.0' });
    await expect(
      handleFlagWriteResponse.call(ctx, items, response(404, '<h1>Not Found</h1>')),
    ).rejects.toThrow('Updating flags needs Flagsmith 2.263.0 or later; this instance runs 2.250.0');
    expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
      'flagsmithAdminApi',
      expect.objectContaining({ url: 'https://flagsmith.example.com/version/' }),
    );
  });

  it('still explains a missing flag API when the version lookup fails', async () => {
    const { ctx } = context(new Error('boom'));
    await expect(handleFlagWriteResponse.call(ctx, items, response(404, undefined))).rejects.toThrow(
      /^Updating flags needs Flagsmith 2\.263\.0 or later$/,
    );
  });

  it('raises other failures as API errors', async () => {
    const { ctx, httpRequestWithAuthentication } = context({});
    await expect(
      handleFlagWriteResponse.call(ctx, items, response(404, { detail: 'Not found.' })),
    ).rejects.toMatchObject({ httpCode: '404' });
    await expect(
      handleFlagWriteResponse.call(ctx, items, response(403, { detail: 'Forbidden' })),
    ).rejects.toMatchObject({ httpCode: '403' });
    expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
  });
});
