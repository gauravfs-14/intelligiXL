import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/** AES-256-GCM for secrets stored in AppSetting.
 *
 * Key source, in order:
 *  1. APP_SECRET env var (any string; hashed to 32 bytes).
 *  2. `.data/app-secret`, generated on first use (mode 0600).
 *
 * The web app and the worker must resolve the same key — same APP_SECRET, or
 * a shared `.data` directory. If the key changes, stored secrets can no longer
 * be decrypted and have to be re-entered on the Settings page. */

const ALGO = "aes-256-gcm";
let cachedKey: Buffer | null = null;

function dataDir(): string {
  // turbopackIgnore: runtime, env-configured path; don't trace the project.
  const storage = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.LOCAL_STORAGE_DIR ?? ".data/storage");
  return path.dirname(storage);
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.APP_SECRET?.trim();
  if (fromEnv) {
    cachedKey = createHash("sha256").update(fromEnv).digest();
    return cachedKey;
  }
  const file = path.join(/*turbopackIgnore: true*/ dataDir(), "app-secret");
  if (!existsSync(file)) {
    mkdirSync(path.dirname(file), { recursive: true });
    // `wx` fails if another process created it first; re-read in that case.
    try {
      writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }
  cachedKey = createHash("sha256").update(readFileSync(file, "utf8").trim()).digest();
  return cachedKey;
}

/** Returns `iv.tag.ciphertext`, each base64. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((b) => b.toString("base64")).join(".");
}

/** Returns null if the value can't be decrypted (wrong key or corrupted). */
export function decrypt(payload: string): string | null {
  try {
    const [iv, tag, ciphertext] = payload.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
