# Changelog

Notable changes go here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

- Project started.
- Express server with an in-memory cache. Requests for the same data share one upstream call.
- `GET /api/weather/hourly?lat=&lon=`: hourly NWS forecast for a US location, cached for an hour. Returns 400 for bad coordinates, 404 outside the US and 502 when NWS fails.
- `GET /api/health`.
- Tests for the cache, the NWS client and the HTTP routes, using recorded NWS responses.
