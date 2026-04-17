import { createHash } from "node:crypto";
import { createClient } from "redis";

type RedisClient = ReturnType<typeof createClient>;

const globalKey = "__issueTrackerRedisTranslation" as const;

function getGlobalClient(): RedisClient | undefined {
  return (globalThis as unknown as Record<string, RedisClient | undefined>)[globalKey];
}

function setGlobalClient(c: RedisClient | undefined) {
  (globalThis as unknown as Record<string, RedisClient | undefined>)[globalKey] = c;
}

function translationTtlSeconds() {
  const raw = process.env.TRANSLATION_REDIS_TTL_SEC?.trim();
  if (!raw) return 60 * 60 * 24 * 90;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 60 ? Math.min(n, 60 * 60 * 24 * 365) : 60 * 60 * 24 * 90;
}

/**
 * Lazy singleton for serverless: reuse one connection per isolate when possible.
 * Returns null if REDIS_URL is unset or connection fails.
 */
export async function getRedisTranslationClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) return null;

  const existing = getGlobalClient();
  if (existing?.isOpen) return existing;
  if (existing && !existing.isOpen) {
    try {
      await existing.connect();
      return existing;
    } catch {
      setGlobalClient(undefined);
    }
  }

  try {
    const client = createClient({ url });
    client.on("error", (err) => {
      console.error("[redis-translation]", err);
    });
    await client.connect();
    setGlobalClient(client);
    return client;
  } catch (e) {
    console.error("[redis-translation] connect failed:", e);
    setGlobalClient(undefined);
    return null;
  }
}

export function buildTranslationCacheKey(
  model: string,
  sourceLanguage: string,
  targetLanguage: string,
  payload: Record<string, string>,
): string {
  const basis = JSON.stringify({ model, sourceLanguage, targetLanguage, payload });
  const hash = createHash("sha256").update(basis).digest("hex");
  return `tr:v1:${hash}`;
}

export async function readTranslationCache(key: string): Promise<string | null> {
  try {
    const r = await getRedisTranslationClient();
    if (!r) return null;
    return await r.get(key);
  } catch (e) {
    console.warn("[redis-translation] get:", e);
    return null;
  }
}

export async function writeTranslationCache(key: string, value: string): Promise<void> {
  try {
    const r = await getRedisTranslationClient();
    if (!r) return;
    await r.set(key, value, { EX: translationTtlSeconds() });
  } catch (e) {
    console.warn("[redis-translation] set:", e);
  }
}
