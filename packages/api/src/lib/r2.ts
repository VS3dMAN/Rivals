import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getEnv } from '../env';

let _client: S3Client | null = null;

export function getR2Client(): S3Client {
  if (_client) return _client;
  const env = getEnv();
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    throw new Error('R2 credentials not configured');
  }
  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

// Test seam: allow injecting a mocked client.
export function setR2ClientForTesting(client: S3Client | null): void {
  _client = client;
}

function getBucket(): string {
  const env = getEnv();
  if (!env.R2_BUCKET) throw new Error('R2_BUCKET not set');
  return env.R2_BUCKET;
}

export interface PresignedPut {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export async function issuePresignedPut(
  key: string,
  contentType: string,
  expiresInSec = 3600,
): Promise<PresignedPut> {
  const client = getR2Client();
  const cmd = new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  });
  const url = await getSignedUrl(client, cmd, { expiresIn: expiresInSec });
  return {
    url,
    method: 'PUT',
    headers: { 'Content-Type': contentType },
  };
}

export interface PresignedGet {
  url: string;
  expiresAt: string;
}

export async function issuePresignedGet(
  key: string,
  expiresInSec = 3600,
): Promise<PresignedGet> {
  const client = getR2Client();
  const cmd = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  const url = await getSignedUrl(client, cmd, { expiresIn: expiresInSec });
  return {
    url,
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
  };
}

export interface ObjectMeta {
  contentLength: number;
  etag: string;
}

// Returns null on 404 / NotFound; throws on other errors.
export async function headObject(key: string): Promise<ObjectMeta | null> {
  const client = getR2Client();
  try {
    const out: HeadObjectCommandOutput = await client.send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key }),
    );
    return {
      contentLength: out.ContentLength ?? 0,
      etag: out.ETag ?? '',
    };
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

export function objectKeyForLog(
  groupId: string,
  habitId: string,
  userId: string,
  logId: string,
): string {
  return `proofs/${groupId}/${habitId}/${userId}/${logId}.jpg`;
}

// Bundle the helpers as a module the route layer can take by injection.
// Using a plain object keeps test mocking simple (vi.fn()) and avoids classes.
export interface R2Module {
  issuePresignedPut: typeof issuePresignedPut;
  issuePresignedGet: typeof issuePresignedGet;
  headObject: typeof headObject;
  objectKeyForLog: typeof objectKeyForLog;
}

export const r2: R2Module = {
  issuePresignedPut,
  issuePresignedGet,
  headObject,
  objectKeyForLog,
};
