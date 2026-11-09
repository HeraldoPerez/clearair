# ClearAir

Find the best hours to be outside today, based on the air-quality forecast and the weather.

The goal: enter a ZIP code and ClearAir shows today's and tomorrow's AQI forecast from AirNow next to the hourly weather from the National Weather Service, and highlights the time windows that look best. Useful for planning a run, a bike ride or an outdoor event, especially in wildfire smoke season.

## Status

Early. The server works: it gets the hourly weather forecast from the National Weather Service for any US location and caches it. AirNow air quality and the React app are next. What's planned and what's done is in [ROADMAP.md](ROADMAP.md).

A note on AirNow: AirNow retired its old "forecast by ZIP code" API on September 30, 2026. ClearAir is being built on the replacement (`/aq/forecast/current/`), so it won't need migrating later.

## Running it locally

Needs Node 22.9 or newer.

```bash
git clone https://github.com/Khalick/clearair.git
cd clearair
cp .env.example .env   # optional for now; the AirNow key will be needed later

cd server
npm install
npm test
npm start              # http://localhost:3001
```

Then try it:

```bash
curl "http://localhost:3001/api/weather/hourly?lat=38.8894&lon=-77.0352"
```

The tests use recorded NWS responses, so they don't need a network connection.

## API

### `GET /api/weather/hourly?lat=<latitude>&lon=<longitude>`

Hourly forecast for about the next 6.5 days. US locations only.

```json
{
  "location": { "lat": 38.8894, "lon": -77.0352, "city": "Washington", "state": "DC", "timeZone": "America/New_York" },
  "updatedAt": "2026-11-09T06:46:31+00:00",
  "hours": [
    {
      "start": "2026-11-09T07:00:00-05:00",
      "end": "2026-11-09T08:00:00-05:00",
      "isDaytime": true,
      "temperatureF": 49,
      "precipitationChance": 0,
      "humidity": 68,
      "windMph": 14,
      "windDirection": "W",
      "summary": "Sunny"
    }
  ]
}
```

| Status | When |
| --- | --- |
| 200 | Forecast found |
| 400 | `lat` or `lon` is missing or out of range |
| 404 | The location is outside the US (no NWS forecast) |
| 502 | The National Weather Service failed or couldn't be reached |

Forecasts are cached for an hour, and the location lookup for a day, so repeat requests don't hit NWS again.

### `GET /api/health`

Returns `{ "ok": true }`.

## Built with

Node.js and Express 5, tested with Node's built-in test runner. The front end will be React (Vite). The server sits in between so API keys stay off the browser and responses get cached.

## Data

Weather from the National Weather Service API (api.weather.gov), which is free and needs no key. Air quality (coming next) from the U.S. EPA AirNow program, used under the AirNow data use guidelines. AirNow data is preliminary. This is a planning tool, not health advice. Not affiliated with or endorsed by NWS or EPA.

## License

MIT, see [LICENSE](LICENSE).
