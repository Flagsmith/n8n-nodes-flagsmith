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
});
