from flask import Flask, render_template, request, jsonify
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
import requests
import json
from datetime import datetime, timedelta
import numpy as np
import calendar
import google.generativeai as genai
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# API Configuration
OPENWEATHER_API_KEY = "c465f37bb98831b900669cac27146b23"
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', "AIzaSyBt_HllccdAWtX3gevrpIge42Zh8keG5Y0")

# Configure Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel('gemini-2.0-flash')

# Setup Open-Meteo API client
cache_session = requests_cache.CachedSession('.cache', expire_after=1800)  # 30 min cache
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

class ClimateDataService:
    def __init__(self):
        self.openweather_key = OPENWEATHER_API_KEY
    
    def normalize_longitude(self, lon):
        """Fix longitude to be in range -180 to 180"""
        while lon > 180:
            lon -= 360
        while lon < -180:
            lon += 360
        return lon
    
    def search_cities(self, query):
        """Search cities using OpenWeatherMap Geocoding API"""
        try:
            url = "http://api.openweathermap.org/geo/1.0/direct"
            params = {
                'q': query,
                'limit': 10,
                'appid': self.openweather_key
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            cities = []
            for city in data:
                cities.append({
                    'name': city['name'],
                    'country': city['country'],
                    'state': city.get('state', ''),
                    'lat': city['lat'],
                    'lon': city['lon'],
                    'display_name': f"{city['name']}, {city.get('state', city['country'])}"
                })
            
            return cities
        except Exception as e:
            print(f"Error searching cities: {e}")
            return []
    
    def get_location_from_coords(self, lat, lon):
        """Get location name from coordinates"""
        try:
            # Fix longitude coordinate
            lon = self.normalize_longitude(lon)
            
            # Try OpenWeatherMap reverse geocoding
            url = "http://api.openweathermap.org/geo/1.0/reverse"
            params = {
                'lat': lat,
                'lon': lon,
                'limit': 1,
                'appid': self.openweather_key
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            if data:
                location = data[0]
                return {
                    'name': location['name'],
                    'country': location['country'],
                    'state': location.get('state', ''),
                    'display_name': f"{location['name']}, {location.get('state', location['country'])}"
                }
        except Exception as e:
            print(f"Error getting location: {e}")
        
        return {
            'name': f"Location",
            'country': "Unknown",
            'state': '',
            'display_name': f"Location ({lat:.2f}, {lon:.2f})"
        }
    
    def get_climate_data(self, lat, lon, period='today'):
        """Get climate data for different time periods"""
        try:
            # Fix longitude coordinate
            lon = self.normalize_longitude(lon)
            
            if period == 'today':
                return self._get_today_data(lat, lon)
            elif period == '7days':
                return self._get_historical_data(lat, lon, 7)
            elif period == '30days':
                return self._get_historical_data(lat, lon, 30)
        except Exception as e:
            print(f"Error getting climate data: {e}")
            return None
    
    def _get_today_data(self, lat, lon):
        """Get today's hourly data"""
        weather_url = "https://api.open-meteo.com/v1/forecast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": [
                "temperature_2m", "precipitation", "rain", "relative_humidity_2m", 
                "windspeed_10m", "weathercode", "precipitation_probability"
            ],
            "current": [
                "temperature_2m", "relative_humidity_2m", "precipitation", 
                "rain", "windspeed_10m", "weathercode"
            ],
            "timezone": "auto",
            "forecast_days": 1
        }
        
        # Air Quality Data
        air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        air_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
            "current": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
            "forecast_days": 1
        }
        
        weather_response = openmeteo.weather_api(weather_url, params=weather_params)[0]
        air_response = openmeteo.weather_api(air_url, params=air_params)[0]
        
        return self._process_hourly_data(weather_response, air_response)
    
    def _get_historical_data(self, lat, lon, days):
        """Get historical data by fetching day by day and aggregating"""
        
        # Fetch weather data with past days
        weather_url = "https://api.open-meteo.com/v1/forecast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "temperature_2m_max", "temperature_2m_min", "precipitation_sum", 
                "rain_sum", "windspeed_10m_max", "weathercode"
            ],
            "timezone": "auto",
            "past_days": days,
            "forecast_days": 0
        }
        
        # Fetch air quality data
        air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        air_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
            "timezone": "auto",
            "past_days": days,
            "forecast_days": 0
        }
        
        weather_response = openmeteo.weather_api(weather_url, params=weather_params)[0]
        air_response = openmeteo.weather_api(air_url, params=air_params)[0]
        
        if days == 7:
            return self._process_daily_data(weather_response, air_response, 7)
        elif days == 30:
            return self._process_weekly_aggregated_data(weather_response, air_response, 30)
    
    def _process_hourly_data(self, weather_response, air_response):
        """Process hourly data for today view"""
        current = weather_response.Current()
        current_air = air_response.Current()
        
        hourly = weather_response.Hourly()
        hourly_air = air_response.Hourly()
        
        # Create timestamps
        timestamps = pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left"
        )
        
        return {
            'period': 'today',
            'current': {
                'temperature': float(round(current.Variables(0).Value(), 1)),
                'humidity': float(round(current.Variables(1).Value(), 1)),
                'precipitation': float(round(current.Variables(2).Value(), 2)),
                'windspeed': float(round(current.Variables(4).Value(), 1)),
                'pm25': float(round(current_air.Variables(1).Value(), 1)),
                'pm10': float(round(current_air.Variables(0).Value(), 1))
            },
            'hourly': {
                'timestamps': [ts.isoformat() for ts in timestamps],
                'hours': [ts.hour for ts in timestamps],
                'temperature': [float(round(x, 1)) for x in hourly.Variables(0).ValuesAsNumpy()],
                'precipitation': [float(round(x, 2)) for x in hourly.Variables(1).ValuesAsNumpy()],
                'humidity': [float(round(x, 1)) for x in hourly.Variables(3).ValuesAsNumpy()],
                'windspeed': [float(round(x, 1)) for x in hourly.Variables(4).ValuesAsNumpy()],
                'pm25': [float(round(x, 1)) for x in hourly_air.Variables(1).ValuesAsNumpy()],
                'pm10': [float(round(x, 1)) for x in hourly_air.Variables(0).ValuesAsNumpy()],
                'co': [float(round(x, 1)) for x in hourly_air.Variables(2).ValuesAsNumpy()],
                'no2': [float(round(x, 1)) for x in hourly_air.Variables(3).ValuesAsNumpy()],
            }
        }
    
    def _process_daily_data(self, weather_response, air_response, days=7):
        """Process daily data for 7-day view"""
        daily = weather_response.Daily()
        hourly_air = air_response.Hourly()
        
        # Create daily timestamps
        daily_timestamps = pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        )
        
        # Process air quality data (aggregate hourly to daily)
        pm25_hourly = hourly_air.Variables(1).ValuesAsNumpy()
        pm10_hourly = hourly_air.Variables(0).ValuesAsNumpy()
        
        # Aggregate to daily averages
        pm25_daily = []
        pm10_daily = []
        
        hours_per_day = 24
        for i in range(len(daily_timestamps)):
            day_start = i * hours_per_day
            day_end = min((i + 1) * hours_per_day, len(pm25_hourly))
            if day_start < len(pm25_hourly):
                pm25_daily.append(float(round(np.mean(pm25_hourly[day_start:day_end]), 1)))
                pm10_daily.append(float(round(np.mean(pm10_hourly[day_start:day_end]), 1)))
            else:
                pm25_daily.append(20.0)  # Default value
                pm10_daily.append(30.0)
        
        return {
            'period': '7days',
            'daily': {
                'dates': [ts.strftime('%Y-%m-%d') for ts in daily_timestamps[-days:]],
                'day_names': [ts.strftime('%a') for ts in daily_timestamps[-days:]],
                'temp_max': [float(round(x, 1)) for x in daily.Variables(0).ValuesAsNumpy()[-days:]],
                'temp_min': [float(round(x, 1)) for x in daily.Variables(1).ValuesAsNumpy()[-days:]],
                'precipitation': [float(round(x, 2)) for x in daily.Variables(2).ValuesAsNumpy()[-days:]],
                'rain': [float(round(x, 2)) for x in daily.Variables(3).ValuesAsNumpy()[-days:]],
                'windspeed': [float(round(x, 1)) for x in daily.Variables(4).ValuesAsNumpy()[-days:]],
                'pm25': pm25_daily[-days:] if len(pm25_daily) >= days else [20.0] * days,
                'pm10': pm10_daily[-days:] if len(pm10_daily) >= days else [30.0] * days
            }
        }
    
    def _process_weekly_aggregated_data(self, weather_response, air_response, days=30):
        """Process 30-day data aggregated into weekly chunks"""
        daily = weather_response.Daily()
        
        daily_timestamps = pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        )
        
        # Get daily data
        temp_max = daily.Variables(0).ValuesAsNumpy()
        temp_min = daily.Variables(1).ValuesAsNumpy()
        precipitation = daily.Variables(2).ValuesAsNumpy()
        
        # Aggregate data into weekly chunks (approximately 4 weeks)
        weeks = 4
        days_per_week = len(temp_max) // weeks
        
        weekly_temp_max = []
        weekly_temp_min = []
        weekly_precipitation = []
        week_labels = []
        
        for i in range(weeks):
            start_idx = i * days_per_week
            end_idx = min((i + 1) * days_per_week, len(temp_max))
            
            if start_idx < len(temp_max):
                week_start = daily_timestamps[start_idx]
                week_labels.append(f"Week {i+1}\n({week_start.strftime('%m/%d')})")
                weekly_temp_max.append(float(round(np.max(temp_max[start_idx:end_idx]), 1)))
                weekly_temp_min.append(float(round(np.min(temp_min[start_idx:end_idx]), 1)))
                weekly_precipitation.append(float(round(np.sum(precipitation[start_idx:end_idx]), 1)))
        
        return {
            'period': '30days',
            'weekly': {
                'weeks': week_labels,
                'temp_max': weekly_temp_max,
                'temp_min': weekly_temp_min,
                'precipitation': weekly_precipitation,
                'pm25': [18.0 + i * 3 for i in range(len(week_labels))],  # Simulated air quality
                'pm10': [28.0 + i * 4 for i in range(len(week_labels))]
            }
        }

    def generate_ai_response(self, user_question, location_info, weather_data):
        """Generate AI response using Gemini with weather context"""
        try:
            # Get location name safely
            location_name = 'Unknown Location'
            if location_info:
                location_name = location_info.get('name') or location_info.get('display_name', 'Unknown Location')
            
            # Build comprehensive context based on available data
            context = f"You are a helpful weather assistant analyzing data for {location_name}.\n\n"
            
            # Handle different time periods
            period = weather_data.get('period', 'unknown')
            context += f"Data Period: {period}\n\n"
            
            if period == 'today' and 'current' in weather_data:
                # Today's current conditions
                current = weather_data['current']
                context += "CURRENT CONDITIONS:\n"
                context += f"- Temperature: {current.get('temperature', 'N/A')}°C\n"
                context += f"- Humidity: {current.get('humidity', 'N/A')}%\n"
                context += f"- Air Quality PM2.5: {current.get('pm25', 'N/A')} μg/m³\n"
                context += f"- Air Quality PM10: {current.get('pm10', 'N/A')} μg/m³\n"
                context += f"- Wind Speed: {current.get('windspeed', 'N/A')} km/h\n"
                context += f"- Precipitation: {current.get('precipitation', 'N/A')} mm\n\n"
                
                # Today's hourly data
                if 'hourly' in weather_data:
                    hourly = weather_data['hourly']
                    if hourly.get('temperature'):
                        temp_data = hourly['temperature']
                        context += f"TODAY'S HOURLY TRENDS:\n"
                        context += f"- Temperature range: {min(temp_data):.1f}°C to {max(temp_data):.1f}°C\n"
                        context += f"- Average temperature: {sum(temp_data)/len(temp_data):.1f}°C\n"
                        
                    if hourly.get('pm25'):
                        pm25_data = hourly['pm25']
                        context += f"- PM2.5 range: {min(pm25_data):.1f} to {max(pm25_data):.1f} μg/m³\n"
                        context += f"- Average PM2.5: {sum(pm25_data)/len(pm25_data):.1f} μg/m³\n"
                        
            elif period in ['7days', '30days'] and 'daily' in weather_data:
                # Historical daily data
                daily = weather_data['daily']
                context += f"{period.upper()} HISTORICAL DATA:\n"
                
                if daily.get('temp_max'):
                    temp_max = daily['temp_max']
                    temp_min = daily['temp_min']
                    context += f"- Temperature range: {min(temp_min):.1f}°C to {max(temp_max):.1f}°C\n"
                    context += f"- Average high: {sum(temp_max)/len(temp_max):.1f}°C\n"
                    context += f"- Average low: {sum(temp_min)/len(temp_min):.1f}°C\n"
                    
                if daily.get('precipitation'):
                    precip = daily['precipitation']
                    total_precip = sum(precip)
                    context += f"- Total precipitation: {total_precip:.1f} mm\n"
                    context += f"- Average daily precipitation: {total_precip/len(precip):.1f} mm\n"
                    
                if daily.get('pm25'):
                    pm25_data = daily['pm25']
                    context += f"- PM2.5 range: {min(pm25_data):.1f} to {max(pm25_data):.1f} μg/m³\n"
                    context += f"- Average PM2.5: {sum(pm25_data)/len(pm25_data):.1f} μg/m³\n"
                    
            # Add available data summary
            context += f"\nAvailable data keys: {list(weather_data.keys())}\n"
            
            context += f"\nUSER QUESTION: {user_question}\n\n"
            context += "Please provide a helpful, detailed response based on the weather data provided above. Include specific numbers and trends when available."
            
            # Generate response using Gemini
            response = gemini_model.generate_content(context)
            return response.text
            
        except Exception as e:
            print(f"Error generating AI response: {e}")
            return "I apologize, but I'm having trouble processing your request right now. Please try asking about the weather data again."

# Initialize service
climate_service = ClimateDataService()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search-cities')
def search_cities():
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify([])
    
    cities = climate_service.search_cities(query)
    return jsonify(cities)

@app.route('/api/location-from-coords')
def location_from_coords():
    lat = float(request.args.get('lat'))
    lon = float(request.args.get('lon'))
    location = climate_service.get_location_from_coords(lat, lon)
    return jsonify(location)

@app.route('/api/climate-data')
def get_climate_data():
    lat = float(request.args.get('lat'))
    lon = float(request.args.get('lon'))
    period = request.args.get('period', 'today')
    
    # Log the coordinates for debugging
    normalized_lon = climate_service.normalize_longitude(lon)
    print(f"Original coords: ({lat}, {lon}) -> Normalized: ({lat}, {normalized_lon})")
    
    data = climate_service.get_climate_data(lat, lon, period)
    if not data:
        return jsonify({'error': 'Failed to fetch climate data'}), 500
    
    return jsonify(data)

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message', '')
        weather_data = data.get('weather_data')
        location = data.get('location')
        
        print(f"Received chat request:")
        print(f"Message: {message}")
        print(f"Weather data available: {bool(weather_data)}")
        print(f"Location: {location}")
        
        if weather_data:
            print(f"Weather data keys: {list(weather_data.keys())}")
            print(f"Weather period: {weather_data.get('period', 'unknown')}")
        
        # Generate AI response using the service
        ai_response = climate_service.generate_ai_response(message, location, weather_data)
        
        print(f"AI response: {ai_response[:100]}...")  # First 100 chars
        
        return jsonify({
            'response': ai_response
        })
        
    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({
            'error': 'Failed to process chat request',
            'response': 'Sorry, there was an error processing your request.'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)