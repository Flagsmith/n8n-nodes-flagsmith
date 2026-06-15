import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { isValidSignature } from '../nodes/shared/signature';

const secret = 'shhh';
const body = '{"event_type":"FLAG_UPDATED"}';
const goodSig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

describe('isValidSignature', () => {
  it('accepts a correct signature', () => {
    expect(isValidSignature(body, goodSig, secret)).toBe(true);
  });
  it('rejects a wrong signature', () => {
    expect(isValidSignature(body, 'deadbeef', secret)).toBe(false);
  });
  it('rejects a missing signature', () => {
    expect(isValidSignature(body, undefined, secret)).toBe(false);
  });
  it('rejects when body is tampered', () => {
    expect(isValidSignature(body + ' ', goodSig, secret)).toBe(false);
  });
  it('accepts a known precomputed signature vector', () => {
    const knownSig = '783ec58eee6dadac9fe9d638deb603e895ea2f07bc3dd4c83aa945a633acafbd';
    expect(isValidSignature(body, knownSig, secret)).toBe(true);
  });
  it('verifies a Buffer body identically to a string body', () => {
    expect(isValidSignature(Buffer.from(body, 'utf8'), goodSig, secret)).toBe(true);
  });
});
