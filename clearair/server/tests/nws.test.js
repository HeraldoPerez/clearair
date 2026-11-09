import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { NotCoveredError, UpstreamError } from "../src/errors.js";
import { createNwsClient, parseWindMph } from "../src/nws.js";

// Real NWS responses for Washington, DC, recorded on 2026-11-09 (hourly trimmed to 6 hours).
const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const points = fixture("nws-points-washington-dc.json");
const hourly = fixture("nws-hourly-washington-dc.json");

const POINTS_URL = "https://api.weather.gov/points/38.8894,-77.0352";
const HOURLY_URL = "https://api.weather.gov/gridpoints/LWX/97,71/forecast/hourly";

/** A fetch that answers from a URL -> [status, body] table and records every call. */
function fakeFetch(routes) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) return new Response("not found", { status: 404 });
    const [status, body] = route;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  fn.calls = calls;
  return fn;
}

const dcRoutes = { [POINTS_URL]: [200, points], [HOURLY_URL]: [200, hourly] };

describe("createNwsClient", () => {
  it("requires a User-Agent", () => {
    assert.throws(() => createNwsClient({}), /userAgent/);
  });

  it("returns the hourly forecast for a US location", async () => {
    const fetch = fakeFetch(dcRoutes);
    const nws = createNwsClient({ userAgent: "test", fetch });

    const result = await nws.getHourlyForecast(38.8894, -77.0352);

    assert.deepEqual(result.location, {
      lat: 38.8894,
      lon: -77.0352,
      city: "Washington",
      state: "DC",
      timeZone: "America/New_York",
    });
    assert.equal(result.hours.length, 6);
    assert.deepEqual(result.hours[0], {
      start: "2026-11-09T07:00:00-05:00",
      end: "2026-11-09T08:00:00-05:00",
      isDaytime: true,
      temperatureF: 49,
      precipitationChance: 0,
      humidity: 68,
      windMph: 14,
      windDirection: "W",
      summary: "Sunny",
    });
    assert.equal(typeof result.updatedAt, "string");
  });

  it("sends the User-Agent NWS asks for", async () => {
    const fetch = fakeFetch(dcRoutes);
    const nws = createNwsClient({ userAgent: "ClearAir (test)", fetch });
    await nws.getHourlyForecast(38.8894, -77.0352);

    for (const call of fetch.calls) {
      assert.equal(call.init.headers["User-Agent"], "ClearAir (test)");
    }
  });

  it("rounds coordinates to 4 decimals, as NWS expects", async () => {
    const fetch = fakeFetch(dcRoutes);
    const nws = createNwsClient({ userAgent: "test", fetch });
    await nws.getHourlyForecast(38.889412, -77.03521);

    assert.equal(fetch.calls[0].url, POINTS_URL);
  });

  it("uses the cache for repeat requests", async () => {
    const fetch = fakeFetch(dcRoutes);
    const nws = createNwsClient({ userAgent: "test", fetch });

    await nws.getHourlyForecast(38.8894, -77.0352);
    await nws.getHourlyForecast(38.8894, -77.0352);

    assert.equal(fetch.calls.length, 2); // one points call + one hourly call
  });

  it("throws NotCoveredError outside the US", async () => {
    const fetch = fakeFetch({}); // NWS answers 404 for points it doesn't cover
    const nws = createNwsClient({ userAgent: "test", fetch });

    await assert.rejects(nws.getHourlyForecast(-1.2864, 36.8172), NotCoveredError);
  });

  it("throws UpstreamError when NWS fails", async () => {
    const fetch = fakeFetch({ [POINTS_URL]: [200, points], [HOURLY_URL]: [500, { title: "Unexpected Problem" }] });
    const nws = createNwsClient({ userAgent: "test", fetch });

    await assert.rejects(nws.getHourlyForecast(38.8894, -77.0352), (err) => {
      assert.ok(err instanceof UpstreamError);
      assert.equal(err.status, 502);
      assert.equal(err.upstreamStatus, 500);
      return true;
    });
  });

  it("throws UpstreamError when NWS can't be reached", async () => {
    const fetch = async () => {
      throw new TypeError("fetch failed");
    };
    const nws = createNwsClient({ userAgent: "test", fetch });

    await assert.rejects(nws.getHourlyForecast(38.8894, -77.0352), UpstreamError);
  });
});

describe("parseWindMph", () => {
  it("reads single speeds and ranges", () => {
    assert.equal(parseWindMph("14 mph"), 14);
    assert.equal(parseWindMph("10 to 15 mph"), 15);
    assert.equal(parseWindMph("calm"), null);
    assert.equal(parseWindMph(undefined), null);
  });
});
