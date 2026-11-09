import express from "express";
import { HttpError } from "./errors.js";

/**
 * Builds the Express app. The weather client is passed in so tests can use a fake one.
 * @param {{ nws: { getHourlyForecast(lat: number, lon: number): Promise<unknown> } }} deps
 */
export function createApp({ nws }) {
  const app = express();
  app.disable("x-powered-by");

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // GET /api/weather/hourly?lat=38.8894&lon=-77.0352
  app.get("/api/weather/hourly", async (req, res) => {
    const lat = parseCoordinate(req.query.lat, -90, 90, "lat");
    const lon = parseCoordinate(req.query.lon, -180, 180, "lon");
    const forecast = await nws.getHourlyForecast(lat, lon);
    res.json(forecast);
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Express 5 sends errors thrown in async handlers here.
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
      if (err.status >= 500) console.error(err);
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  });

  return app;
}

function parseCoordinate(raw, min, max, name) {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new HttpError(400, `Query parameter "${name}" is required`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(400, `"${name}" must be a number between ${min} and ${max}`);
  }
  return value;
}
