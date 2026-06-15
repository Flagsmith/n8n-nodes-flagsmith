import { createHmac, timingSafeEqual } from 'crypto';

export function isValidSignature(
  rawBody: string | Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  // Expected is always 64-char SHA-256 hex (fixed, public length), so this guard
  // leaks nothing; it exists to keep timingSafeEqual from throwing on length mismatch.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
