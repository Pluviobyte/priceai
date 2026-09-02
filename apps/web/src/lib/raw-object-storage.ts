import { S3JsonObjectStore } from "@price-radar/object-storage";

const globalForStorage = globalThis as typeof globalThis & {
  priceRadarObjectStore?: S3JsonObjectStore;
};

export const rawObjectStore = globalForStorage.priceRadarObjectStore ?? new S3JsonObjectStore({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? "http://127.0.0.1:9000",
  region: process.env.OBJECT_STORAGE_REGION ?? "auto",
  bucket: process.env.OBJECT_STORAGE_BUCKET ?? "price-radar-snapshots",
  accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY ?? "minio",
  secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? "minio-secret",
});

if (process.env.NODE_ENV !== "production") globalForStorage.priceRadarObjectStore = rawObjectStore;
