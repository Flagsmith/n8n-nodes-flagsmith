import { describe, it, expect } from 'vitest';
import {
  classifyFlagWrite,
  serverVersionFrom,
  unsupportedMessage,
  versionUrl,
} from '../nodes/shared/flagWrite';

describe('classifyFlagWrite', () => {
  it('passes a 2xx response through', () => {
    expect(classifyFlagWrite(200, { environment_default: {} })).toBe('ok');
  });
  it('recognises a write refused because change requests are enabled', () => {
    const body = { detail: 'Cannot make this change…', code: 'change_requests_enabled' };
    expect(classifyFlagWrite(409, body)).toBe('changeRequestsEnabled');
  });
  it('leaves other conflicts as errors', () => {
    expect(classifyFlagWrite(409, { detail: 'Something else' })).toBe('error');
  });
  it('reads a 404 without a detail as a missing flag API', () => {
    expect(classifyFlagWrite(404, '<h1>Not Found</h1>')).toBe('unsupported');
    expect(classifyFlagWrite(404, undefined)).toBe('unsupported');
    expect(classifyFlagWrite(404, {})).toBe('unsupported');
  });
  it('leaves a 404 from the flag API itself as an error', () => {
    expect(classifyFlagWrite(404, { detail: 'No Feature matches the given query.' })).toBe('error');
  });
  it('leaves other failures as errors', () => {
    expect(classifyFlagWrite(403, { detail: 'Forbidden' })).toBe('error');
    expect(classifyFlagWrite(500, undefined)).toBe('error');
  });
});

describe('versionUrl', () => {
  it('points at the instance root for SaaS', () => {
    expect(versionUrl('https://api.flagsmith.com/api/v1')).toBe('https://api.flagsmith.com/version/');
  });
  it('handles trailing slashes and self-hosted bases', () => {
    expect(versionUrl('https://flagsmith.example.com/api/v1/')).toBe(
      'https://flagsmith.example.com/version/',
    );
  });
});

describe('serverVersionFrom', () => {
  it('reads a release tag', () => {
    expect(serverVersionFrom({ image_tag: '2.250.0' })).toBe('2.250.0');
    expect(serverVersionFrom({ image_tag: 'v2.250.0' })).toBe('2.250.0');
  });
  it('treats a tag that is not a version as unknown', () => {
    expect(serverVersionFrom({ image_tag: 'latest' })).toBeUndefined();
    expect(serverVersionFrom({ image_tag: 'a013d7b4d' })).toBeUndefined();
    expect(serverVersionFrom({ image_tag: 'unknown' })).toBeUndefined();
    expect(serverVersionFrom(undefined)).toBeUndefined();
  });
});

describe('unsupportedMessage', () => {
  it('names the instance version when known', () => {
    expect(unsupportedMessage('2.250.0')).toBe(
      'Updating flags needs Flagsmith 2.263.0 or later; this instance runs 2.250.0',
    );
  });
  it('omits the version when unknown', () => {
    expect(unsupportedMessage(undefined)).toBe('Updating flags needs Flagsmith 2.263.0 or later');
  });
});
