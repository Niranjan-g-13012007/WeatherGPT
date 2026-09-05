# WeatherGPT — Frontend Prototype

Conversational AI for Weather Forecasting, Alerts, and Climate Information.
This is a **frontend-only prototype** — no backend, no database, no real LLM.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints (usually `http://localhost:5173`).

To build a production bundle:

```bash
npm run build
npm run preview
```

## Folder structure

```
src/
  components/   Navbar, WeatherCard, ChatMessage, ChatInput, RiskBadge,
                ForecastCard, LocationPicker, AtmosphereVisual, WeatherIcon,
                DataState (loading/error UI)
  context/      LocationContext.jsx — shared location + weather state
                across all pages (so switching city on one page updates
                the chatbot, forecast, and hero visual everywhere)
  pages/        Home, Login, Signup, Assistant (chatbot), Forecast, About
  services/     weatherService.js — the ONLY place that calls Open-Meteo
  utils/        weatherCode.js, riskEngine.js, chatbot.js
  data/         locations.js — predefined list of cities
```

## Open-Meteo integration

All network calls live in `src/services/weatherService.js`, using:

```
https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}
  &hourly=temperature_2m,relative_humidity_2m,precipitation_probability,
          precipitation,rain,weather_code,wind_speed_10m,
          wind_direction_10m,pressure_msl
  &daily=weather_code,temperature_2m_max,temperature_2m_min,
         precipitation_probability_max,precipitation_sum,wind_speed_10m_max
  &timezone=auto&forecast_days=7
```

No API key is required or used. `LocationContext.jsx` fetches this on load
and whenever the user picks a new city, then derives:

- `buildCurrentSnapshot()` → the closest hourly reading to "now", used for
  the WeatherCard, hero visual, and risk badge.
- `buildDailySummaries()` → the 7-day array used on the Forecast page.

Every number shown in the UI (temperature, humidity, rain %, wind, pressure)
comes directly from this payload — nothing is hardcoded.

`weatherCode.js` converts Open-Meteo's numeric WMO codes into readable
labels and an icon category. `riskEngine.js` is a simple prototype-only
rule engine (LOW / MODERATE / HIGH / EXTREME) based on rain probability,
rainfall, wind speed, and storm codes — explicitly **not** an official
IMD warning system.

## Chatbot response engine

`src/utils/chatbot.js` is a lightweight intent-matcher: it looks at the
user's text for keywords (rain, tomorrow, travel, weekend, temperature,
wind, humidity, risk) and generates a natural-language answer by reading
the actual fetched Open-Meteo data — grouping hourly points by day, finding
the peak rain-probability window, and composing a sentence around it.

This function is intentionally the *only* place response text is built,
so it can be swapped out later without touching any component:

```
CURRENT:  React → weatherService.js → Open-Meteo
FUTURE:   React → POST /api/chat → FastAPI → Open-Meteo + ML model + LLM
```

To wire up the real backend later: replace the body of `generateResponse()`
in `chatbot.js` with a `fetch('/api/chat', { method: 'POST', body: ... })`
call, keep the same function signature, and the Assistant page needs no
changes.

## What's intentionally not built

- No real authentication — Login/Signup validate fields client-side and
  store a name/email in `localStorage`, then route to `/assistant`.
- No backend, database, or LLM of any kind.
- Risk thresholds are illustrative prototype rules, not real warning
  criteria.
