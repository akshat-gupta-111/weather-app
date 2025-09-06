from flask import Flask, render_template, request, jsonify
import openmeteo_requests
import pandas as pd
import requests_cache
from retry_requests import retry
import requests
import json
from datetime import datetime, timedelta
import numpy as np
import google.generativeai as genai

app = Flask(__name__)

# API Configuration
OPENWEATHER_API_KEY = "c465f37bb98831b900669cac27146b23"
# You need to get this from Google AI Studio
GEMINI_API_KEY = "AIzaSyBt_HllccdAWtX3gevrpIge42Zh8keG5Y0"
# Configure Gemini AI
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-pro')

# Setup Open-Meteo API client
cache_session = requests_cache.CachedSession('.cache', expire_after=3600)
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

class WeatherService:
    def __init__(self):
        self.openweather_key = OPENWEATHER_API_KEY
    
    def get_coordinates_from_city(self, city_name):
        """Get coordinates from city name using OpenWeather Geocoding API"""
        try:
            url = f"http://api.openweathermap.org/geo/1.0/direct"
            params = {
                'q': city_name,
                'limit': 1,
                'appid': self.openweather_key
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            if data:
                return {
                    'lat': data[0]['lat'],
                    'lon': data[0]['lon'],
                    'name': data[0]['name'],
                    'country': data[0]['country']
                }
            return None
        except Exception as e:
            print(f"Error getting coordinates: {e}")
            return None
    
    def get_location_name_from_coords(self, lat, lon):
        """Get location name from coordinates using reverse geocoding"""
        try:
            # Try OpenWeather reverse geocoding first
            url = f"http://api.openweathermap.org/geo/1.0/reverse"
            params = {
                'lat': lat,
                'lon': lon,
                'limit': 1,
                'appid': self.openweather_key
            }
            response = requests.get(url, params=params)
            data = response.json()
            
            if data:
                location_info = data[0]
                city = location_info.get('name', '')
                state = location_info.get('state', '')
                country = location_info.get('country', '')
                
                # Format the location name
                if city and state and country:
                    return f"{city}, {state}, {country}"
                elif city and country:
                    return f"{city}, {country}"
                elif country:
                    return country
            
            # Fallback to a free reverse geocoding service
            fallback_url = f"https://api.bigdatacloud.net/data/reverse-geocode-client"
            fallback_params = {
                'latitude': lat,
                'longitude': lon,
                'localityLanguage': 'en'
            }
            
            fallback_response = requests.get(fallback_url, params=fallback_params)
            fallback_data = fallback_response.json()
            
            if fallback_data:
                city = fallback_data.get('city', '')
                region = fallback_data.get('principalSubdivision', '')
                country = fallback_data.get('countryName', '')
                
                if city and region and country:
                    return f"{city}, {region}, {country}"
                elif city and country:
                    return f"{city}, {country}"
                elif region and country:
                    return f"{region}, {country}"
                elif country:
                    return country
                    
        except Exception as e:
            print(f"Error getting location name: {e}")
        
        # Final fallback - return coordinates
        return f"Location ({lat:.2f}, {lon:.2f})"
    
    def get_weather_data(self, lat, lon):
        """Get comprehensive weather data from Open-Meteo"""
        try:
            # Current and forecast weather data
            weather_url = "https://api.open-meteo.com/v1/forecast"
            weather_params = {
                "latitude": lat,
                "longitude": lon,
                "daily": [
                    "temperature_2m_max", "temperature_2m_min", "precipitation_sum", 
                    "rain_sum", "precipitation_hours", "precipitation_probability_max",
                    "weathercode", "windspeed_10m_max"
                ],
                "hourly": [
                    "temperature_2m", "rain", "precipitation", "precipitation_probability", 
                    "relative_humidity_2m", "windspeed_10m", "weathercode"
                ],
                "current": [
                    "temperature_2m", "relative_humidity_2m", "precipitation", 
                    "rain", "windspeed_10m", "weathercode"
                ],
                "timezone": "GMT",
                "past_days": 7,
                "forecast_days": 7
            }
            
            weather_responses = openmeteo.weather_api(weather_url, params=weather_params)
            weather_response = weather_responses[0]
            
            # Air Quality Data
            air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
            air_params = {
                "latitude": lat,
                "longitude": lon,
                "hourly": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
                "current": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
                "past_days": 7,
                "forecast_days": 3
            }
            
            air_responses = openmeteo.weather_api(air_url, params=air_params)
            air_response = air_responses[0]
            
            return self._process_weather_data(weather_response, air_response)
        
        except Exception as e:
            print(f"Error fetching weather data: {e}")
            return None
    
    def _process_weather_data(self, weather_response, air_response):
        """Process and structure weather data"""
        
        # Current weather data
        current = weather_response.Current()
        current_data = {
            'temperature': float(round(current.Variables(0).Value(), 1)),
            'humidity': float(round(current.Variables(1).Value(), 1)),
            'precipitation': float(round(current.Variables(2).Value(), 2)),
            'rain': float(round(current.Variables(3).Value(), 2)),
            'windspeed': float(round(current.Variables(4).Value(), 1)),
            'weathercode': int(current.Variables(5).Value()),
            'timestamp': current.Time()
        }
        
        # Current air quality
        air_current = air_response.Current()
        current_air = {
            'pm10': float(round(air_current.Variables(0).Value(), 1)),
            'pm2_5': float(round(air_current.Variables(1).Value(), 1)),
            'co': float(round(air_current.Variables(2).Value(), 1)),
            'no2': float(round(air_current.Variables(3).Value(), 1)),
            'ozone': float(round(air_current.Variables(4).Value(), 1))
        }
        
        # Hourly data for charts
        hourly = weather_response.Hourly()
        hourly_air = air_response.Hourly()
        
        # Create timestamps
        hourly_timestamps = pd.date_range(
            start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly.Interval()),
            inclusive="left"
        )
        
        hourly_data = {
            'timestamps': [ts.isoformat() for ts in hourly_timestamps],
            'temperature': [float(round(x, 1)) for x in hourly.Variables(0).ValuesAsNumpy()],
            'humidity': [float(round(x, 1)) for x in hourly.Variables(4).ValuesAsNumpy()],
            'precipitation': [float(round(x, 2)) for x in hourly.Variables(2).ValuesAsNumpy()],
            'windspeed': [float(round(x, 1)) for x in hourly.Variables(5).ValuesAsNumpy()],
            'pm2_5': [float(round(x, 1)) for x in hourly_air.Variables(1).ValuesAsNumpy()],
            'pm10': [float(round(x, 1)) for x in hourly_air.Variables(0).ValuesAsNumpy()]
        }
        
        # Daily forecast
        daily = weather_response.Daily()
        daily_timestamps = pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        )
        
        daily_data = {
            'dates': [ts.strftime('%Y-%m-%d') for ts in daily_timestamps],
            'temp_max': [float(round(x, 1)) for x in daily.Variables(0).ValuesAsNumpy()],
            'temp_min': [float(round(x, 1)) for x in daily.Variables(1).ValuesAsNumpy()],
            'precipitation': [float(round(x, 2)) for x in daily.Variables(2).ValuesAsNumpy()],
            'rain_sum': [float(round(x, 2)) for x in daily.Variables(3).ValuesAsNumpy()],
            'precipitation_prob': [float(round(x, 1)) for x in daily.Variables(5).ValuesAsNumpy()],
            'windspeed_max': [float(round(x, 1)) for x in daily.Variables(7).ValuesAsNumpy()]
        }
        
        return {
            'current': current_data,
            'current_air': current_air,
            'hourly': hourly_data,
            'daily': daily_data,
            'coordinates': {
                'lat': float(weather_response.Latitude()),
                'lon': float(weather_response.Longitude())
            }
        }
    
    def detect_anomalies(self, data):
        """Simple threshold-based anomaly detection"""
        anomalies = []
        
        # Temperature anomalies
        if data['current']['temperature'] > 40:
            anomalies.append({
                'type': 'extreme_heat',
                'message': f"Extreme heat warning: {data['current']['temperature']}°C",
                'severity': 'high'
            })
        elif data['current']['temperature'] < -20:
            anomalies.append({
                'type': 'extreme_cold',
                'message': f"Extreme cold warning: {data['current']['temperature']}°C",
                'severity': 'high'
            })
        
        # Air quality anomalies
        pm2_5 = data['current_air']['pm2_5']
        if pm2_5 > 150:
            anomalies.append({
                'type': 'air_quality',
                'message': f"Hazardous air quality: PM2.5 at {pm2_5} μg/m³",
                'severity': 'high'
            })
        elif pm2_5 > 55:
            anomalies.append({
                'type': 'air_quality',
                'message': f"Unhealthy air quality: PM2.5 at {pm2_5} μg/m³",
                'severity': 'medium'
            })
        
        # Precipitation anomalies
        if any(p > 50 for p in data['daily']['precipitation'][:3]):  # Next 3 days
            anomalies.append({
                'type': 'heavy_rain',
                'message': "Heavy rainfall expected in the next 3 days",
                'severity': 'medium'
            })
        
        return anomalies
    
    def generate_ai_summary(self, data, location_name):
        """Generate AI summary using Gemini"""
        try:
            prompt = f"""
            Analyze this climate data for {location_name} and provide a concise, beginner-friendly summary:
            
            Current Conditions:
            - Temperature: {data['current']['temperature']}°C
            - Humidity: {data['current']['humidity']}%
            - Air Quality PM2.5: {data['current_air']['pm2_5']} μg/m³
            
            7-day Forecast:
            - Max temps: {data['daily']['temp_max'][:7]}
            - Min temps: {data['daily']['temp_min'][:7]}
            - Precipitation: {data['daily']['precipitation'][:7]}
            
            Please provide:
            1. Current weather overview (2-3 sentences)
            2. Key patterns or trends (2-3 sentences)
            3. Health recommendations based on air quality (1-2 sentences)
            4. What to expect this week (2-3 sentences)
            
            Keep it simple and actionable for non-technical users.
            """
            
            response = model.generate_content(prompt)
            return response.text
        
        except Exception as e:
            return f"Current conditions in {location_name}: Temperature is {data['current']['temperature']}°C with {data['current']['humidity']}% humidity. Air quality PM2.5 is at {data['current_air']['pm2_5']} μg/m³. Check the detailed charts below for trends and forecasts."

weather_service = WeatherService()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/weather', methods=['POST'])
def get_weather():
    data = request.get_json()
    
    if 'city' in data:
        # Get coordinates from city name
        coords = weather_service.get_coordinates_from_city(data['city'])
        if not coords:
            return jsonify({'error': 'City not found'}), 404
        lat, lon = coords['lat'], coords['lon']
        location_name = f"{coords['name']}, {coords['country']}"
    else:
        # Use provided coordinates and get location name
        lat, lon = data['lat'], data['lon']
        location_name = weather_service.get_location_name_from_coords(lat, lon)
    
    # Get weather data
    weather_data = weather_service.get_weather_data(lat, lon)
    if not weather_data:
        return jsonify({'error': 'Failed to fetch weather data'}), 500
    
    # Detect anomalies
    anomalies = weather_service.detect_anomalies(weather_data)
    
    # Generate AI summary
    ai_summary = weather_service.generate_ai_summary(weather_data, location_name)
    
    return jsonify({
        'location': location_name,
        'weather_data': weather_data,
        'anomalies': anomalies,
        'ai_summary': ai_summary,
        'timestamp': datetime.now().isoformat()
    })
@app.route('/api/cities')
def search_cities():
    query = request.args.get('q', '')
    if len(query) < 2:
        return jsonify([])
    
    try:
        url = f"http://api.openweathermap.org/geo/1.0/direct"
        params = {
            'q': query,
            'limit': 10,
            'appid': OPENWEATHER_API_KEY
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
                'lon': city['lon']
            })
        
        return jsonify(cities)
    except Exception as e:
        return jsonify([]), 500

if __name__ == '__main__':
    app.run(debug=True)