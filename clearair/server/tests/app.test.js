import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/app.js";
import { NotCoveredError, UpstreamError } from "../src/errors.js";

// A fake weather client, so these tests check only the HTTP layer.
const nws = {
  async getHourlyForecast(lat, lon) {
    if (lat === 0 && lon === 0) throw new NotCoveredError();
    if (lat === 1 && lon === 1) throw new UpstreamError("National Weather Service returned HTTP 500");
    if (lat === 2 && lon === 2) throw new Error("a bug");
    return { location: { lat, lon }, hours: [] };
  },
};

let server;
let base;

before(async () => {
  const app = createApp({ nws });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
});

async function get(path) {
  const res = await fetch(base + path);
  return { status: res.status, body: await res.json() };
}

describe("server", () => {
  it("answers the health check", async () => {
    assert.deepEqual(await get("/api/health"), { status: 200, body: { ok: true } });
  });

  it("returns the hourly forecast", async () => {
    const { status, body } = await get("/api/weather/hourly?lat=38.8894&lon=-77.0352");
    assert.equal(status, 200);
    assert.deepEqual(body.location, { lat: 38.8894, lon: -77.0352 });
  });

  it("rejects missing or invalid coordinates with 400", async () => {
    for (const query of ["", "?lat=38.9", "?lat=abc&lon=-77", "?lat=91&lon=0", "?lat=0&lon=-181"]) {
      const { status, body } = await get(`/api/weather/hourly${query}`);
      assert.equal(status, 400, query);
      assert.match(body.error, /lat|lon/);
    }
  });

  it("returns 404 for places outside NWS coverage", async () => {
    const { status, body } = await get("/api/weather/hourly?lat=0&lon=0");
    assert.equal(status, 404);
    assert.match(body.error, /only covers the US/);
  });

  it("returns 502 when NWS fails", async (t) => {
    t.mock.method(console, "error", () => {});
    const { status } = await get("/api/weather/hourly?lat=1&lon=1");
    assert.equal(status, 502);
  });

  it("hides unexpected errors behind a 500", async (t) => {
    t.mock.method(console, "error", () => {});
    const { status, body } = await get("/api/weather/hourly?lat=2&lon=2");
    assert.equal(status, 500);
    assert.doesNotMatch(body.error, /a bug/);
  });

  it("returns JSON 404 for unknown API routes", async () => {
    const { status, body } = await get("/api/nope");
    assert.equal(status, 404);
    assert.equal(body.error, "Not found");
  });
});
