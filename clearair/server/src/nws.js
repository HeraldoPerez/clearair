import { TtlCache } from "./cache.js";
import { NotCoveredError, UpstreamError } from "./errors.js";

export const NWS_BASE_URL = "https://api.weather.gov";

const HOUR = 60 * 60 * 1000;
// A point's forecast grid almost never changes, so keep it for a day.
const POINTS_TTL = 24 * HOUR;
// NWS updates hourly forecasts about once an hour.
const HOURLY_TTL = HOUR;

/**
 * Client for the National Weather Service API (api.weather.gov).
 * No key is needed, but NWS asks every app to send a User-Agent that identifies it.
 */
export function createNwsClient({
  userAgent,
  fetch: fetchImpl = globalThis.fetch,
  baseUrl = NWS_BASE_URL,
  cache = new TtlCache(),
} = {}) {
  if (!userAgent) throw new Error("createNwsClient: userAgent is required by the NWS API");

  async function getJson(url) {
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { "User-Agent": userAgent, Accept: "application/geo+json" },
      });
    } catch (cause) {
      throw new UpstreamError("Couldn't reach the National Weather Service", { url, cause });
    }
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new UpstreamError(`National Weather Service returned HTTP ${res.status}`, {
        url,
        upstreamStatus: res.status,
      });
    }
    try {
      return await res.json();
    } catch (cause) {
      throw new UpstreamError("National Weather Service sent a response that isn't JSON", { url, cause });
    }
  }

  /** Looks up which forecast grid a point belongs to. */
  async function getPoint(lat, lon) {
    // NWS redirects anything with more than 4 decimals, so round first.
    // Rounding also makes nearby requests share one cache entry.
    const coords = `${round4(lat)},${round4(lon)}`;
    return cache.getOrLoad(`points:${coords}`, POINTS_TTL, async () => {
      const data = await getJson(`${baseUrl}/points/${coords}`);
      const props = data?.properties;
      if (!props?.forecastHourly) throw new NotCoveredError();
      return {
        forecastHourlyUrl: props.forecastHourly,
        timeZone: props.timeZone ?? null,
        city: props.relativeLocation?.properties?.city ?? null,
        state: props.relativeLocation?.properties?.state ?? null,
      };
    });
  }

  /**
   * Hourly forecast for a US location, about 6.5 days ahead.
   * Throws NotCoveredError outside NWS coverage and UpstreamError if NWS fails.
   */
  async function getHourlyForecast(lat, lon) {
    const point = await getPoint(lat, lon);
    const forecast = await cache.getOrLoad(`hourly:${point.forecastHourlyUrl}`, HOURLY_TTL, async () => {
      const data = await getJson(point.forecastHourlyUrl);
      const periods = data?.properties?.periods;
      if (!Array.isArray(periods)) {
        throw new UpstreamError("National Weather Service sent a forecast without hourly periods", {
          url: point.forecastHourlyUrl,
        });
      }
      return {
        updatedAt: data.properties.updateTime ?? data.properties.generatedAt ?? null,
        hours: periods.map(toHour),
      };
    });

    return {
      location: {
        lat: round4(lat),
        lon: round4(lon),
        city: point.city,
        state: point.state,
        timeZone: point.timeZone,
      },
      ...forecast,
    };
  }

  return { getHourlyForecast };
}

/** Converts one NWS period into the smaller shape the client uses. */
function toHour(period) {
  return {
    start: period.startTime,
    end: period.endTime,
    isDaytime: Boolean(period.isDaytime),
    temperatureF: toFahrenheit(period.temperature, period.temperatureUnit),
    precipitationChance: period.probabilityOfPrecipitation?.value ?? null,
    humidity: period.relativeHumidity?.value ?? null,
    windMph: parseWindMph(period.windSpeed),
    windDirection: period.windDirection || null,
    summary: period.shortForecast || "",
  };
}

function toFahrenheit(value, unit) {
  if (typeof value !== "number") return null;
  return unit === "C" ? Math.round((value * 9) / 5 + 32) : value;
}

/** "14 mph" -> 14, "10 to 15 mph" -> 15 (the higher one), anything else -> null. */
export function parseWindMph(text) {
  if (typeof text !== "string") return null;
  const numbers = text.match(/\d+(\.\d+)?/g);
  if (!numbers) return null;
  return Math.max(...numbers.map(Number));
}

function round4(n) {
  return Math.round(n * 10_000) / 10_000;
}
