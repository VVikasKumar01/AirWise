interface CacheRecord<T> {
  value: T;
  expiresAtMs: number;
}

/**
 * Bounded in-memory TTL cache with LRU-style eviction to prevent unbounded
 * memory growth when serving many distinct coordinates or queries.
 */
export class TtlCache<T> {
  private readonly store = new Map<string, CacheRecord<T>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;

  constructor(maxEntries: number, ttlMs: number) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const record = this.store.get(key);
    if (!record) return null;
    if (Date.now() > record.expiresAtMs) {
      this.store.delete(key);
      return null;
    }
    // Refresh insertion order for LRU behavior
    this.store.delete(key);
    this.store.set(key, record);
    return record.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      this.evictExpiredOrOldest();
    }
    this.store.set(key, {
      value,
      expiresAtMs: Date.now() + this.ttlMs,
    });
  }

  get size(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  private evictExpiredOrOldest(): void {
    const now = Date.now();
    for (const [k, v] of this.store.entries()) {
      if (now > v.expiresAtMs) {
        this.store.delete(k);
      }
    }
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
  }
}
