import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import {
  issuePresignedPut,
  issuePresignedGet,
  headObject,
  objectKeyForLog,
  setR2ClientForTesting,
} from './r2';

const REQUIRED_ENV = {
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_JWT_SECRET: 'jwt-secret-value',
  JWT_SECRET: 'test-secret-at-least-16-chars-long',
  R2_ACCOUNT_ID: 'test-account',
  R2_ACCESS_KEY_ID: 'AKIATEST',
  R2_SECRET_ACCESS_KEY: 'secrettest',
  R2_BUCKET: 'rivals-proofs',
};

describe('r2 module', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let s3Mock: ReturnType<typeof mockClient>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    Object.assign(process.env, REQUIRED_ENV);
    // Clear the env cache by importing the module fresh; we re-set the client.
    setR2ClientForTesting(null);
    // Build a real client and mock it.
    const client = new S3Client({
      region: 'auto',
      endpoint: 'https://test-account.r2.cloudflarestorage.com',
      forcePathStyle: true,
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secrettest' },
    });
    s3Mock = mockClient(client);
    setR2ClientForTesting(client);
  });

  afterEach(() => {
    s3Mock.restore();
    setR2ClientForTesting(null);
    process.env = originalEnv;
  });

  it('issuePresignedPut returns a URL with X-Amz-Expires=3600', async () => {
    const out = await issuePresignedPut('proofs/g/h/u/l.jpg', 'image/jpeg', 3600);
    expect(out.method).toBe('PUT');
    expect(out.headers['Content-Type']).toBe('image/jpeg');
    expect(out.url).toMatch(/X-Amz-Expires=3600/);
    expect(out.url).toContain('proofs/g/h/u/l.jpg');
  });

  it('issuePresignedGet returns a URL and expiresAt', async () => {
    const out = await issuePresignedGet('proofs/g/h/u/l.jpg', 600);
    expect(out.url).toMatch(/X-Amz-Expires=600/);
    expect(typeof out.expiresAt).toBe('string');
    expect(new Date(out.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('headObject returns null on NotFound', async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    const out = await headObject('missing.jpg');
    expect(out).toBeNull();
  });

  it('headObject returns metadata on success', async () => {
    s3Mock.on(HeadObjectCommand).resolves({ ContentLength: 1234, ETag: '"abc"' });
    const out = await headObject('exists.jpg');
    expect(out).toEqual({ contentLength: 1234, etag: '"abc"' });
  });

  it('headObject rethrows non-404 errors', async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    await expect(headObject('forbidden.jpg')).rejects.toMatchObject({ name: 'AccessDenied' });
  });

  it('objectKeyForLog formats the path correctly', () => {
    const k = objectKeyForLog('g1', 'h1', 'u1', 'l1');
    expect(k).toBe('proofs/g1/h1/u1/l1.jpg');
  });

  // Touch mocks to silence unused-import warnings if linters complain.
  void PutObjectCommand;
  void GetObjectCommand;
});
