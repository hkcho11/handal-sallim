// Short-lived, account-scoped memory only. Never use browser storage for finance data.
const lifetime = 10_000;
let owner: string | null = null;
let generation = 0;
const values = new Map<string, { value: unknown; expires: number }>();
const pending = new Map<string, Promise<unknown>>();

export function invalidateReads() {
  generation++;
  values.clear();
  pending.clear();
}

export function setReadScope(user: string | null) {
  if (owner !== user) invalidateReads();
  owner = user;
}

export async function cachedRead<T>(
  key: string,
  load: () => Promise<T>,
  fresh = false,
): Promise<T> {
  if (typeof window === "undefined" || !owner) return load();
  const existing = values.get(key);
  if (!fresh && existing && existing.expires > Date.now())
    return structuredClone(existing.value) as T;
  if (fresh) values.delete(key);
  const running = pending.get(key);
  if (running) return structuredClone(await running) as T;
  const version = generation;
  const work = load();
  pending.set(key, work);
  try {
    const value = await work;
    if (generation === version)
      values.set(key, {
        value: structuredClone(value),
        expires: Date.now() + lifetime,
      });
    return value;
  } finally {
    if (pending.get(key) === work) pending.delete(key);
  }
}
