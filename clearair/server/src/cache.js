/**
 * Small in-memory cache with a time limit per entry.
 *
 * Used so the server asks the weather and air-quality APIs as little as
 * possible. If two requests for the same key arrive while the first is still
 * loading, they share one upstream call.
 */
export class TtlCache {
  #entries = new Map(); // key -> { value, expiresAt }
  #pending = new Map(); // key -> Promise
  #maxEntries;
  #now;

  /**
   * @param {object} [options]
   * @param {number} [options.maxEntries] Oldest entries are dropped past this size.
   * @param {() => number} [options.now] Clock in milliseconds. Tests pass a fake one.
   */
  constructor({ maxEntries = 500, now = Date.now } = {}) {
    this.#maxEntries = maxEntries;
    this.#now = now;
  }

  get size() {
    return this.#entries.size;
  }

  /** Returns the cached value, or undefined if it's missing or expired. */
  get(key) {
    const entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttlMs) {
    // Re-inserting moves the key to the end, so the Map stays oldest-first.
    this.#entries.delete(key);
    this.#entries.set(key, { value, expiresAt: this.#now() + ttlMs });
    while (this.#entries.size > this.#maxEntries) {
      const oldest = this.#entries.keys().next().value;
      this.#entries.delete(oldest);
    }
  }

  /**
   * Returns the cached value for `key`, or calls `load()` and caches what it
   * returns for `ttlMs`. Errors are not cached, so the next call tries again.
   */
  async getOrLoad(key, ttlMs, load) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const inFlight = this.#pending.get(key);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        const value = await load();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.#pending.delete(key);
      }
    })();
    this.#pending.set(key, promise);
    return promise;
  }
}
