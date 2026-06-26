# USA Weather

A simple weather dashboard for viewing current conditions, hourly forecasts, and a 5-day outlook for locations in the United States. The app uses the Open-Meteo API for weather data and geocoding.

## Features

- Search for a city, state, or ZIP code
- View current weather, humidity, wind, and precipitation
- Browse a 24-hour forecast and a 5-day forecast
- Save the last searched location in browser storage
- Optional background jazz audio toggle

## Run locally

1. Open the project folder in a browser, or serve it with a simple static server.
2. Start a local server from the project directory, for example:
   ```bash
   python3 -m http.server 8000
   ```
3. Visit the URL shown by the local server in your browser.

## Notes

- The app uses remote CDN assets for Tailwind CSS and Font Awesome.
- No local machine-specific paths or references are included in the project files.
