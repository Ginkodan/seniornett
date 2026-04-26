import { createHmac, createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type S3Config = {
  endpoint: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  forcePathStyle: boolean;
};

type FsConfig = {
  mode: "filesystem";
  rootDir: string;
};

type StorageConfig = S3Config | FsConfig;

const ensuredBuckets = new Set<string>();

function toDateStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function toAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(value: Buffer | Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function deriveSigningKey(secretAccessKey: string, dateStamp: string, region: string, service = "s3") {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

function normalizeKey(key: string) {
  return key.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function getStorageConfig(): StorageConfig {
  const endpoint = process.env.SENIORNETT_MEDIA_S3_ENDPOINT;
  const accessKeyId = process.env.SENIORNETT_MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SENIORNETT_MEDIA_S3_SECRET_ACCESS_KEY;
  const bucket = process.env.SENIORNETT_MEDIA_S3_BUCKET;
  const region = process.env.SENIORNETT_MEDIA_S3_REGION || "garage";

  if (endpoint && accessKeyId && secretAccessKey && bucket) {
    return {
      endpoint: new URL(endpoint),
      region,
      accessKeyId,
      secretAccessKey,
      bucket,
      forcePathStyle: (process.env.SENIORNETT_MEDIA_S3_FORCE_PATH_STYLE || "true").toLowerCase() !== "false",
    };
  }

  return {
    mode: "filesystem",
    rootDir: process.env.SENIORNETT_MEDIA_DIR || path.join(process.cwd(), ".seniornett-media"),
  };
}

function buildS3Url(config: S3Config, bucket: string, key = "") {
  const url = new URL(config.endpoint.toString());
  const pathname = config.forcePathStyle
    ? `/${bucket}${key ? `/${normalizeKey(key)}` : ""}`
    : key
      ? `/${normalizeKey(key)}`
      : "/";

  url.pathname = pathname;
  return url;
}

async function signedS3Fetch(
  config: S3Config,
  method: "GET" | "HEAD" | "PUT" | "DELETE",
  bucket: string,
  key = "",
  body?: Buffer | Uint8Array
) {
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(now);
  const payload = body ? Buffer.from(body) : Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const host = config.endpoint.host;
  const canonicalUri = config.forcePathStyle
    ? `/${bucket}${key ? `/${normalizeKey(key)}` : ""}`
    : key
      ? `/${normalizeKey(key)}`
      : "/";
  const canonicalHeaders = `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = deriveSigningKey(config.secretAccessKey, dateStamp, config.region);
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(buildS3Url(config, bucket, key), {
    method,
    headers: {
      Host: host,
      "X-Amz-Content-Sha256": payloadHash,
      "X-Amz-Date": amzDate,
      Authorization: authorization,
    },
    body: method === "GET" || method === "HEAD" ? undefined : payload,
  });
}

export async function ensureBucket(name: string) {
  const storage = getStorageConfig();
  if ("mode" in storage) {
    await mkdir(path.join(storage.rootDir, name), { recursive: true });
    ensuredBuckets.add(name);
    return;
  }

  if (ensuredBuckets.has(name)) {
    return;
  }

  const response = await signedS3Fetch(storage, "PUT", name);
  if (!(response.ok || response.status === 409)) {
    throw new Error(`Failed to create bucket ${name}: ${response.status}`);
  }

  ensuredBuckets.add(name);
}

export async function putObject(name: string, key: string, bytes: Buffer, mimeType?: string) {
  const storage = getStorageConfig();
  if ("mode" in storage) {
    const fullPath = path.join(storage.rootDir, name, key);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, bytes);
    return;
  }

  await ensureBucket(name);
  const response = await signedS3Fetch(storage, "PUT", name, key, bytes);
  if (!response.ok) {
    throw new Error(`Failed to store object ${name}/${key}: ${response.status}`);
  }

  if (mimeType) {
    // No-op for S3: the app stores MIME type in the database, so we don't need
    // to set object metadata here.
  }
}

export async function getObject(name: string, key: string): Promise<Buffer> {
  const storage = getStorageConfig();
  if ("mode" in storage) {
    return readFile(path.join(storage.rootDir, name, key));
  }

  const response = await signedS3Fetch(storage, "GET", name, key);
  if (!response.ok) {
    throw new Error(`Failed to load object ${name}/${key}: ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
