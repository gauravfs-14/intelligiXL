import { localStorageAdapter, storageKeyFor } from "./local";
import type { StorageAdapter } from "./types";

/** Single seam for swapping to an S3-compatible client in production
 * (NFR — local storage is prototype-only). */
export const storage: StorageAdapter = localStorageAdapter;

export { storageKeyFor };
export type { StorageAdapter };
