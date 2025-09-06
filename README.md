# Climate Data Visual Explorer

A modern web application to visualize, analyze, and explore climate and weather data for any location worldwide. Powered by Flask, OpenWeather, Open-Meteo, and Google Gemini AI.

---

## Features

- **Location Selection:**
  - Search for cities
  - Select locations via interactive map or globe
- **Comprehensive Data:**
  - Current weather (temperature, humidity, wind, precipitation)
  - Air quality (PM2.5, PM10, CO, NO2, Ozone)
  - 7-day weather forecast
- **AI Insights:**
  - Gemini AI generates beginner-friendly climate summaries
- **Anomaly Detection:**
  - Alerts for extreme heat/cold, hazardous air quality, heavy rain
- **Interactive Visuals:**
  - Charts for temperature, precipitation, air quality, and forecast
  - Responsive, dark-themed UI
- **Export Data:**
  - Download climate data as JSON
- **Auto-Refresh:**
  - Data updates every 5 minutes

---

## Technologies Used

- **Backend:** Python (Flask)
- **Frontend:** HTML, CSS, JavaScript
  - [Chart.js](https://www.chartjs.org/) for charts
  - [Leaflet.js](https://leafletjs.com/) for maps
- **APIs:**
  - [OpenWeather](https://openweathermap.org/) (geocoding, weather)
  - [Open-Meteo](https://open-meteo.com/) (weather, air quality)
  - [Google Gemini AI](https://ai.google.dev/) (AI summaries)

---

## Project Structure

```
weather-app/
├── app.py                  # Flask backend
├── static/
│   ├── app.js              # Main frontend JS
│   ├── app_backup.js       # Backup JS (older version)
│   └── style.css           # Stylesheet
├── templates/
│   └── index.html          # Main HTML template
```

---

## How It Works

1. **User selects a location** (city search, map, or globe)
2. **App fetches weather & air quality data** from OpenWeather and Open-Meteo
3. **Anomalies detected** (e.g., extreme heat, poor air quality)
4. **Gemini AI generates a summary** of climate conditions and trends
5. **Frontend displays:**
   - Current conditions
   - AI summary
   - Alerts
   - Interactive charts
   - 7-day forecast
6. **User can export data** or let the app auto-refresh

---

## Setup & Running Locally

### 1. Install Python dependencies

```bash
pip install flask openmeteo_requests pandas requests_cache retry_requests numpy google-generativeai
```

### 2. Set API Keys
- **OpenWeather API Key:** Set in `app.py` (`OPENWEATHER_API_KEY`)
- **Google Gemini API Key:** Set in `app.py` (`GEMINI_API_KEY`)

### 3. Start the Flask server

```bash
python app.py
```

### 4. Open in your browser

Go to [http://localhost:5000](http://localhost:5000)

---

## File Overview

- **app.py:** Flask backend, API endpoints, weather service logic, anomaly detection, AI summary
- **static/app.js:** Main frontend logic (UI, charts, map, globe, data fetching)
- **static/style.css:** Responsive, dark-themed styles
- **templates/index.html:** Main UI layout and structure

---

## Credits

- Data: [OpenWeather](https://openweathermap.org/), [Open-Meteo](https://open-meteo.com/)
- Maps: [OpenStreetMap](https://www.openstreetmap.org/)
- Charts: [Chart.js](https://www.chartjs.org/)
- AI: [Google Gemini AI](https://ai.google.dev/)

---

## License

This project is for educational and personal use. Please check API terms for commercial use.

---

## Author

Akshat Gupta

---

## Screenshots

> Add screenshots of the app UI here for better documentation.

---

## Contributing

Pull requests and suggestions are welcome!
