# Roadmap

Rough plan. Estimates are my guesses and will change.

## v0.1.0: first usable version
- [x] Express server with an in-memory cache
- [x] Hourly weather from the National Weather Service, by latitude/longitude
- [ ] AirNow forecast through the new `/aq/forecast/current/` service (the old ZIP endpoint was retired on Sept 30, 2026) (~4h)
- [ ] Search by ZIP code: use the reporting area's location from AirNow to fetch the weather (~2h)
- [ ] React (Vite) client: search box, today's and tomorrow's AQI, hourly weather (~5h)
- [ ] Best-hours view: score each hour from AQI, temperature, rain and wind, and highlight the best windows (~4h)
- [ ] Retry once when NWS returns a 500 (its hourly endpoint fails now and then) (~1h)
- [ ] Deploy the server and client, then tag v0.1.0 (~3h)

## v0.2.0
- [ ] Current observations (`/aq/observation/current/ziplatlong/`) next to the forecast (~3h)
- [ ] "Use my location" with browser geolocation (~1h)
- [ ] Alert when tomorrow looks bad (~5h)
- [ ] Settings for what counts as a good hour (sensitive groups, heat, rain) (~3h)

## Later
- [ ] Rate limiting on the server (~1h)
- [ ] Client tests and GitHub Actions CI (~3h)
- [ ] Accessibility and mobile layout pass (~2h)
