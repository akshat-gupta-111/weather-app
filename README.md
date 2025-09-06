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

## 🌍 Climate Explorer - AI-Powered Weather Analytics Platform

<div align="center">

![Climate Explorer](https://img.shields.io/badge/Climate-Explorer-blue?style=for-the-badge&logo=weather&logoColor=white)
![Version](https://img.shields.io/badge/version-2.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-orange?style=for-the-badge)

**A sophisticated weather analytics platform powered by AI, providing comprehensive climate insights through interactive visualizations and intelligent analysis.**

[🚀 Live Demo](#) • [📋 Features](#features) • [🛠️ Tech Stack](#tech-stack) • [🔧 Installation](#installation) • [🌐 Deploy](#deployment)

</div>

---

## 📋 Features

### 🔍 **Interactive Global Weather Exploration**
- **3D Globe Interface**: Navigate through a fully interactive 3D globe powered by D3.js
- **City Search**: Search and select from thousands of cities worldwide
- **Real-time Coordinates**: Click anywhere on the globe to get instant weather data
- **Multi-timeframe Analysis**: Switch between Today, 7 Days, and 30 Days views

### 🤖 **AI-Powered Weather Assistant**
- **Google Gemini Integration**: Advanced AI chatbot powered by Google's Gemini 2.0 Flash model
- **Contextual Analysis**: AI understands and analyzes your weather data in real-time
- **Intelligent Insights**: Get detailed explanations about weather patterns, anomalies, and trends
- **Natural Language Queries**: Ask questions in plain English about any weather metric

### 📊 **Comprehensive Weather Analytics**
- **Current Conditions**: Real-time temperature, humidity, precipitation, and wind data
- **Hourly Forecasts**: 24-hour detailed weather predictions with interactive charts
- **Historical Trends**: 7-day and 30-day historical weather analysis
- **Air Quality Monitoring**: Real-time PM2.5, PM10, CO, NO2, and Ozone levels
- **Interactive Charts**: Beautiful visualizations powered by Chart.js

### 🎨 **Modern User Interface**
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Dark Theme**: Professional dark interface with blue accent colors
- **Smooth Animations**: Fluid transitions and loading states
- **Intuitive Navigation**: User-friendly interface with clear visual hierarchy

---

## 🛠️ Tech Stack

### **Backend Technologies**
- **Flask** - Python web framework for API development
- **Python 3.8+** - Core programming language
- **Google Generative AI** - LLM integration for intelligent responses
- **OpenMeteo API** - Weather data provider
- **Air Quality API** - Environmental data source
- **Pandas** - Data manipulation and analysis
- **Requests** - HTTP library for API calls

### **Frontend Technologies**
- **HTML5 & CSS3** - Modern web standards
- **JavaScript ES6+** - Interactive functionality
- **D3.js** - 3D globe visualization and data binding
- **Chart.js** - Weather charts and graphs
- **Fetch API** - Asynchronous data fetching

### **APIs & External Services**
- **Open-Meteo Weather API** - Primary weather data source
- **Air Quality API** - Environmental monitoring data
- **Google Gemini 2.0 Flash** - Advanced language model
- **Geocoding Services** - Location resolution and city search

### **Development Tools**
- **Git** - Version control
- **Vercel** - Deployment platform
- **Virtual Environment** - Python dependency isolation

---

## 🚀 Installation & Setup

### Prerequisites
- Python 3.8 or higher
- Git
- Google Gemini API Key

### 1. Clone Repository
```bash
git clone https://github.com/your-username/weather-app.git
cd weather-app
```

### 2. Create Virtual Environment
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY=your_google_gemini_api_key_here
FLASK_ENV=development
```

### 5. Run the Application
```bash
python app.py
```

The application will be available at `http://localhost:5000`

---

## 🧠 AI Chatbot Capabilities

The integrated AI assistant provides intelligent weather analysis through:

### **Contextual Understanding**
- Automatically receives current weather data for your selected location
- Understands different time periods (current, historical, forecasts)
- Processes complex weather patterns and relationships

### **Advanced Analytics**
- **Anomaly Detection**: Identifies unusual weather patterns
- **Trend Analysis**: Explains temperature, precipitation, and air quality trends
- **Comparative Analysis**: Compares current conditions with historical averages
- **Health Recommendations**: Provides air quality and weather-based health advice

### **Natural Language Processing**
- Understands questions like "Is the air quality safe today?"
- Explains complex meteorological concepts in simple terms
- Provides detailed analysis with specific data points and measurements

### **Example Queries**
```
🗣️ "What's the air quality like?"
🤖 "The air quality is currently good with PM2.5 at 12.3 μg/m³..."

🗣️ "Any temperature anomalies?"
🤖 "Today's temperature is 3°C above the weekly average..."

🗣️ "Should I go for a run?"
🤖 "Based on current conditions (PM2.5: 8.4 μg/m³, humidity: 65%...)..."
```

---

## 📊 Data Sources & APIs

### **Weather Data**
- **Primary Source**: Open-Meteo Weather API
- **Coverage**: Global weather data with hourly updates
- **Metrics**: Temperature, humidity, precipitation, wind speed, weather codes
- **Historical Range**: Up to 30 days of historical data

### **Air Quality Data**
- **Source**: Open-Meteo Air Quality API
- **Pollutants**: PM2.5, PM10, Carbon Monoxide, Nitrogen Dioxide, Ozone
- **Update Frequency**: Hourly updates
- **Health Classifications**: WHO and EPA standard compliance

### **Location Services**
- **Geocoding**: Reverse geocoding for coordinates to location names
- **City Search**: Comprehensive global city database
- **Coordinate Precision**: Accurate to 4 decimal places

---

## 🎯 Key Features Explained

### **Interactive 3D Globe**
- **Technology**: D3.js with GeoJSON world map data
- **Functionality**: Click-to-select locations, smooth rotations, zoom controls
- **Data Integration**: Real-time coordinate to weather data pipeline

### **Multi-Timeframe Analysis**
- **Today**: Current conditions + 24-hour hourly forecast
- **7 Days**: Weekly trends with daily aggregations
- **30 Days**: Monthly patterns and historical comparisons

### **Air Quality Heatmap**
- **Visual Coding**: Color-coded air quality levels (Good/Moderate/Unhealthy)
- **WHO Standards**: Based on World Health Organization guidelines
- **Real-time Updates**: Synchronized with weather data refresh

### **Responsive Charts**
- **Chart Types**: Line charts for trends, bar charts for comparisons
- **Interactivity**: Hover tooltips, legend filtering, responsive scaling
- **Data Binding**: Real-time updates when location or timeframe changes

---

## 🌐 Deployment on Vercel

### **Prepare for Deployment**

1. **Create `vercel.json` Configuration File**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "app.py",
      "use": "@vercel/python"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app.py"
    }
  ],
  "env": {
    "GEMINI_API_KEY": "@gemini_api_key"
  }
}
```

2. **Create `requirements.txt`**
```txt
flask==2.3.3
openmeteo-requests==1.1.0
requests-cache==1.1.1
retry-requests==2.0.0
pandas==2.0.3
numpy==1.24.3
google-generativeai==0.3.2
python-dotenv==1.0.0
gunicorn==21.2.0
```

3. **Update `app.py` for Production**
```python
import os
from dotenv import load_dotenv

load_dotenv()

# Use environment variables
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
```

### **Deploy to Vercel**

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Login to Vercel**
```bash
vercel login
```

3. **Deploy**
```bash
vercel --prod
```

4. **Set Environment Variables**
```bash
vercel env add GEMINI_API_KEY
# Enter your Google Gemini API key when prompted
```

### **Post-Deployment Steps**

1. **Verify Deployment**
   - Test all API endpoints
   - Verify AI chatbot functionality
   - Check weather data loading

2. **Monitor Performance**
   - Use Vercel Analytics
   - Monitor API response times
   - Check error logs

3. **Custom Domain** (Optional)
```bash
vercel domains add your-domain.com
```

---

## 🔧 Configuration Options

### **Environment Variables**
- `GEMINI_API_KEY`: Google Gemini API key for AI functionality
- `FLASK_ENV`: Set to 'production' for deployment
- `PORT`: Server port (default: 5000)

### **API Rate Limits**
- **Open-Meteo**: 10,000 requests/day (free tier)
- **Google Gemini**: Based on your API quota
- **Recommended**: Implement caching for production use

### **Performance Optimization**
- Enable response caching (30-minute cache implemented)
- Use CDN for static assets
- Implement request rate limiting for production

---

## 📱 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Fully Supported |
| Firefox | 88+ | ✅ Fully Supported |
| Safari | 14+ | ✅ Fully Supported |
| Edge | 90+ | ✅ Fully Supported |
| Opera | 76+ | ✅ Fully Supported |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Workflow**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Open-Meteo** for providing comprehensive weather APIs
- **Google** for Gemini AI capabilities
- **D3.js Community** for amazing visualization tools
- **Chart.js** for beautiful, responsive charts
- **Vercel** for seamless deployment platform

---

## 📞 Support

For support, please open an issue on GitHub or contact us at [your-email@domain.com](mailto:your-email@domain.com).

---

<div align="center">

**Made with ❤️ by [Your Name]**

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github)](https://github.com/your-username/weather-app)
[![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?style=for-the-badge&logo=vercel)](https://vercel.com)

</div>

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
