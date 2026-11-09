import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TtlCache } from "../src/cache.js";

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe("TtlCache", () => {
  it("returns a cached value until it expires", () => {
    const clock = fakeClock();
    const cache = new TtlCache({ now: clock.now });
    cache.set("a", 1, 1000);

    clock.advance(999);
    assert.equal(cache.get("a"), 1);

    clock.advance(1);
    assert.equal(cache.get("a"), undefined);
  });

  it("only calls load once while the value is fresh", async () => {
    const clock = fakeClock();
    const cache = new TtlCache({ now: clock.now });
    let calls = 0;
    const load = async () => ++calls;

    assert.equal(await cache.getOrLoad("k", 1000, load), 1);
    assert.equal(await cache.getOrLoad("k", 1000, load), 1);
    assert.equal(calls, 1);

    clock.advance(1000);
    assert.equal(await cache.getOrLoad("k", 1000, load), 2);
  });

  it("shares one load between requests that arrive at the same time", async () => {
    const cache = new TtlCache();
    let calls = 0;
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    const load = async () => {
      calls++;
      await gate;
      return "value";
    };

    const both = Promise.all([cache.getOrLoad("k", 1000, load), cache.getOrLoad("k", 1000, load)]);
    release();
    assert.deepEqual(await both, ["value", "value"]);
    assert.equal(calls, 1);
  });

  it("doesn't cache failures", async () => {
    const cache = new TtlCache();
    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error("upstream down");
      return "ok";
    };

    await assert.rejects(cache.getOrLoad("k", 1000, flaky), /upstream down/);
    assert.equal(await cache.getOrLoad("k", 1000, flaky), "ok");
  });

  it("drops the oldest entries past maxEntries", () => {
    const cache = new TtlCache({ maxEntries: 2 });
    cache.set("a", 1, 1000);
    cache.set("b", 2, 1000);
    cache.set("c", 3, 1000);

    assert.equal(cache.size, 2);
    assert.equal(cache.get("a"), undefined);
    assert.equal(cache.get("c"), 3);
  });
});
