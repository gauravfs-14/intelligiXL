import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { StorageAdapter } from "./types";

// turbopackIgnore: this is a dynamic, env-configured path outside the
// project tree (prototype-only local storage — see src/lib/storage/index.ts
// for the S3-swap seam), not something Turbopack should trace/bundle.
const ROOT = resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LOCAL_STORAGE_DIR ?? ".data/storage");

/** Resolves a storage key to an absolute path, rejecting anything that
 * would escape the storage root (NFR-009 — uploads must not be publicly
 * reachable, and definitely not readable via a crafted key). */
function resolveKey(key: string): string {
  const path = resolve(/*turbopackIgnore: true*/ ROOT, key);
  if (path !== ROOT && !path.startsWith(ROOT + sep)) {
    throw new Error(`Storage key escapes storage root: ${key}`);
  }
  return path;
}

export const localStorageAdapter: StorageAdapter = {
  async put(key, data) {
    const path = resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  },
  async get(key) {
    return readFile(resolveKey(key));
  },
  async delete(key) {
    await rm(resolveKey(key), { force: true });
  },
  async exists(key) {
    try {
      await access(resolveKey(key));
      return true;
    } catch {
      return false;
    }
  },
};

export function storageKeyFor(...parts: string[]): string {
  return join(...parts);
}
