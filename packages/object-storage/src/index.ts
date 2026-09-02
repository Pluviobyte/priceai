import { createHash } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface StoredJsonObject {
  uri: string;
  sha256: string;
  size: number;
}

export class S3JsonObjectStore {
  readonly #client: S3Client;
  readonly #bucket: string;
  #ready: Promise<void> | null = null;

  constructor(config: ObjectStorageConfig) {
    this.#bucket = config.bucket;
    this.#client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async #ensureBucket(): Promise<void> {
    this.#ready ??= (async () => {
      try {
        await this.#client.send(new HeadBucketCommand({ Bucket: this.#bucket }));
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status !== 404) throw error;
        await this.#client.send(new CreateBucketCommand({ Bucket: this.#bucket }));
      }
    })();
    return this.#ready;
  }

  async putJson(key: string, value: unknown): Promise<StoredJsonObject> {
    await this.#ensureBucket();
    const body = Buffer.from(JSON.stringify(value));
    const sha256 = createHash("sha256").update(body).digest("hex");
    await this.#client.send(new PutObjectCommand({
      Bucket: this.#bucket,
      Key: key,
      Body: body,
      ContentType: "application/json; charset=utf-8",
      Metadata: { sha256 },
    }));
    return { uri: `s3://${this.#bucket}/${key}`, sha256, size: body.length };
  }

  async getBytes(uri: string, maxBytes = 25 * 1024 * 1024): Promise<Uint8Array> {
    const parsed = new URL(uri);
    if (parsed.protocol !== "s3:" || parsed.hostname !== this.#bucket) {
      throw new Error("object_uri_not_allowed");
    }
    const key = parsed.pathname.replace(/^\//, "");
    if (!key || key.includes("..")) throw new Error("object_key_not_allowed");
    const result = await this.#client.send(new GetObjectCommand({ Bucket: this.#bucket, Key: key }));
    if ((result.ContentLength ?? 0) > maxBytes) throw new Error("object_too_large");
    if (!result.Body) throw new Error("object_body_missing");
    const bytes = await result.Body.transformToByteArray();
    if (bytes.byteLength > maxBytes) throw new Error("object_too_large");
    return bytes;
  }

  destroy(): void {
    this.#client.destroy();
  }
}
