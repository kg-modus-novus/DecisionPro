import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

/** S3-shaped PSA landing on local filesystem (MinIO/S3 swap later via same key layout). */
export class FilesystemPsaStore {
  root = config.psaRoot;

  async EnsureRootReady() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async PutObject(objectKey: string, bytes: Buffer) {
    const full = path.join(this.root, objectKey.replace(/\//g, path.sep));
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return {
      objectKey,
      byteLength: bytes.length,
      contentHash: crypto.createHash('sha256').update(bytes).digest('hex'),
    };
  }

  async GetObject(objectKey: string) {
    const full = path.join(this.root, objectKey.replace(/\//g, path.sep));
    return fs.readFile(full);
  }

  async DeletePrefix(prefix: string) {
    const full = path.join(this.root, prefix.replace(/\//g, path.sep));
    await fs.rm(full, { recursive: true, force: true });
  }

  async ListKeys(prefix = '') {
    const base = path.join(this.root, prefix.replace(/\//g, path.sep));
    const out: string[] = [];
    async function walk(dir: string, rel: string) {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(path.join(dir, e.name), r);
        else out.push(r.replace(/\\/g, '/'));
      }
    }
    await walk(base, prefix.replace(/\\/g, '/').replace(/\/$/, ''));
    return out.filter(Boolean);
  }
}

export const psaStore = new FilesystemPsaStore();
