/**
 * Storage Abstraction — Local Filesystem + Cloudflare R2
 *
 * Auto-detects which backend to use at runtime:
 *   - If R2_ACCOUNT_ID / R2_ACCESS_KEY / R2_SECRET_KEY / R2_BUCKET are set → R2
 *   - Otherwise → local filesystem (/app/uploads in Docker)
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

// ─── Storage Interface ───────────────────────────────────────────

export interface StorageAdapter {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  getBuffer(key: string): Promise<Buffer>;
  getUrl(key: string): string;
  delete(key: string): Promise<void>;
  isR2(): boolean;
}

// ─── Local Filesystem Adapter ────────────────────────────────────

const LOCAL_UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

class LocalStorageAdapter implements StorageAdapter {
  constructor() {
    // Ensure upload directory exists
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }

  async upload(key: string, buffer: Buffer, _contentType: string): Promise<string> {
    const filePath = path.join(LOCAL_UPLOAD_DIR, key);
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, buffer);
    return this.getUrl(key);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const filePath = path.join(LOCAL_UPLOAD_DIR, key);
    return fs.readFileSync(filePath);
  }

  getUrl(key: string): string {
    // Return a proxy path that the API will serve
    return `/api/receipts/image/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = path.join(LOCAL_UPLOAD_DIR, key);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // File may already be gone
    }
  }

  isR2(): boolean {
    return false;
  }
}

// ─── Cloudflare R2 Adapter ───────────────────────────────────────

class R2StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const accountId = process.env.R2_ACCOUNT_ID!;
    this.bucket = process.env.R2_BUCKET || 'perdiemify-uploads';

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
      },
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    return this.getUrl(key);
  }

  async getBuffer(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  getUrl(key: string): string {
    // Return proxy path — frontend never talks directly to R2
    return `/api/receipts/image/${encodeURIComponent(key)}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  isR2(): boolean {
    return true;
  }
}

// ─── Factory ─────────────────────────────────────────────────────

let _storage: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (!_storage) {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY } = process.env;
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY) {
      console.log('[Storage] Using Cloudflare R2');
      _storage = new R2StorageAdapter();
    } else {
      console.log(`[Storage] Using local filesystem (${LOCAL_UPLOAD_DIR})`);
      _storage = new LocalStorageAdapter();
    }
  }
  return _storage;
}

/**
 * Get the content-type for a file based on extension.
 */
export function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.pdf': 'application/pdf',
  };
  return types[ext] || 'application/octet-stream';
}

/**
 * Generate a storage key for a receipt image.
 */
export function receiptStorageKey(userId: string, receiptId: string, originalFilename: string): string {
  const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
  return `receipts/${userId}/${receiptId}${ext}`;
}
