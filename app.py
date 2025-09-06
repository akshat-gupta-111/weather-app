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

app = Flask(__name__)

# API Configuration
OPENWEATHER_API_KEY = "c465f37bb98831b900669cac27146b23"

# Setup Open-Meteo API client
cache_session = requests_cache.CachedSession('.cache', expire_after=1800)  # 30 min cache
retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
openmeteo = openmeteo_requests.Client(session=retry_session)

class ClimateDataService:
    def __init__(self):
        self.openweather_key = OPENWEATHER_API_KEY
    
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
            if period == 'today':
                return self._get_today_data(lat, lon)
            elif period == '7days':
                return self._get_weekly_data(lat, lon)
            elif period == '30days':
                return self._get_monthly_data(lat, lon)
            elif period == '1year':
                return self._get_yearly_data(lat, lon)
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
    
    def _get_weekly_data(self, lat, lon):
        """Get last 7 days daily data"""
        weather_url = "https://api.open-meteo.com/v1/forecast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "temperature_2m_max", "temperature_2m_min", "precipitation_sum", 
                "rain_sum", "windspeed_10m_max", "weathercode"
            ],
            "timezone": "auto",
            "past_days": 7,
            "forecast_days": 0
        }
        
        air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        air_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
            "timezone": "auto",
            "past_days": 7,
            "forecast_days": 0
        }
        
        weather_response = openmeteo.weather_api(weather_url, params=weather_params)[0]
        air_response = openmeteo.weather_api(air_url, params=air_params)[0]
        
        return self._process_daily_data(weather_response, air_response, 7)
    
    def _get_monthly_data(self, lat, lon):
        """Get last 30 days weekly aggregated data"""
        weather_url = "https://api.open-meteo.com/v1/forecast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "temperature_2m_max", "temperature_2m_min", "precipitation_sum", 
                "rain_sum", "windspeed_10m_max", "weathercode"
            ],
            "timezone": "auto",
            "past_days": 30,
            "forecast_days": 0
        }
        
        air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        air_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
            "timezone": "auto",
            "past_days": 30,
            "forecast_days": 0
        }
        
        weather_response = openmeteo.weather_api(weather_url, params=weather_params)[0]
        air_response = openmeteo.weather_api(air_url, params=air_params)[0]
        
        return self._process_weekly_aggregated_data(weather_response, air_response)
    
    def _get_yearly_data(self, lat, lon):
        """Get last 12 months data"""
        weather_url = "https://api.open-meteo.com/v1/forecast"
        weather_params = {
            "latitude": lat,
            "longitude": lon,
            "daily": [
                "temperature_2m_max", "temperature_2m_min", "precipitation_sum", 
                "rain_sum", "windspeed_10m_max"
            ],
            "timezone": "auto",
            "past_days": 365,
            "forecast_days": 0
        }
        
        air_url = "https://air-quality-api.open-meteo.com/v1/air-quality"
        air_params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": ["pm10", "pm2_5", "carbon_monoxide", "nitrogen_dioxide", "ozone"],
            "timezone": "auto",
            "past_days": 365,
            "forecast_days": 0
        }
        
        weather_response = openmeteo.weather_api(weather_url, params=weather_params)[0]
        air_response = openmeteo.weather_api(air_url, params=air_params)[0]
        
        return self._process_monthly_data(weather_response, air_response)
    
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
        air_timestamps = pd.date_range(
            start=pd.to_datetime(hourly_air.Time(), unit="s", utc=True),
            end=pd.to_datetime(hourly_air.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=hourly_air.Interval()),
            inclusive="left"
        )
        
        pm25_hourly = hourly_air.Variables(1).ValuesAsNumpy()
        pm10_hourly = hourly_air.Variables(0).ValuesAsNumpy()
        
        # Aggregate to daily averages
        pm25_daily = []
        pm10_daily = []
        
        for i in range(len(daily_timestamps)):
            day_start = i * 24
            day_end = (i + 1) * 24
            if day_end <= len(pm25_hourly):
                pm25_daily.append(float(np.mean(pm25_hourly[day_start:day_end])))
                pm10_daily.append(float(np.mean(pm10_hourly[day_start:day_end])))
            else:
                pm25_daily.append(0.0)
                pm10_daily.append(0.0)
        
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
                'pm25': pm25_daily[-days:] if pm25_daily else [0.0] * days,
                'pm10': pm10_daily[-days:] if pm10_daily else [0.0] * days
            }
        }
    
    def _process_weekly_aggregated_data(self, weather_response, air_response):
        """Process 30-day data aggregated into weekly chunks"""
        daily = weather_response.Daily()
        hourly_air = air_response.Hourly()
        
        daily_timestamps = pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        )
        
        # Aggregate data into weekly chunks (4-5 weeks)
        temp_max = daily.Variables(0).ValuesAsNumpy()
        temp_min = daily.Variables(1).ValuesAsNumpy()
        precipitation = daily.Variables(2).ValuesAsNumpy()
        
        weeks = []
        week_labels = []
        weekly_temp_max = []
        weekly_temp_min = []
        weekly_precipitation = []
        
        # Create 4 weeks from last 30 days
        for i in range(4):
            start_idx = i * 7
            end_idx = min((i + 1) * 7, len(temp_max))
            if start_idx < len(temp_max):
                week_start = daily_timestamps[start_idx]
                week_labels.append(f"Week {i+1}")
                weekly_temp_max.append(float(np.max(temp_max[start_idx:end_idx])))
                weekly_temp_min.append(float(np.min(temp_min[start_idx:end_idx])))
                weekly_precipitation.append(float(np.sum(precipitation[start_idx:end_idx])))
        
        return {
            'period': '30days',
            'weekly': {
                'weeks': week_labels,
                'temp_max': weekly_temp_max,
                'temp_min': weekly_temp_min,
                'precipitation': weekly_precipitation,
                'pm25': [20.0, 25.0, 22.0, 18.0],  # Placeholder - would need complex air aggregation
                'pm10': [30.0, 35.0, 32.0, 28.0]
            }
        }
    
    def _process_monthly_data(self, weather_response, air_response):
        """Process yearly data aggregated by month"""
        daily = weather_response.Daily()
        
        daily_timestamps = pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left"
        )
        
        # Group by month
        df = pd.DataFrame({
            'date': daily_timestamps,
            'temp_max': daily.Variables(0).ValuesAsNumpy(),
            'temp_min': daily.Variables(1).ValuesAsNumpy(),
            'precipitation': daily.Variables(2).ValuesAsNumpy()
        })
        
        df['month'] = df['date'].dt.to_period('M')
        monthly_data = df.groupby('month').agg({
            'temp_max': 'mean',
            'temp_min': 'mean',
            'precipitation': 'sum'
        }).tail(12)  # Last 12 months
        
        return {
            'period': '1year',
            'monthly': {
                'months': [month.strftime('%b %Y') for month in monthly_data.index.to_timestamp()],
                'temp_max': [float(round(x, 1)) for x in monthly_data['temp_max'].values],
                'temp_min': [float(round(x, 1)) for x in monthly_data['temp_min'].values],
                'precipitation': [float(round(x, 1)) for x in monthly_data['precipitation'].values],
                'pm25': [15.0 + i * 2 for i in range(12)],  # Placeholder
                'pm10': [25.0 + i * 3 for i in range(12)]
            }
        }

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
    
    data = climate_service.get_climate_data(lat, lon, period)
    if not data:
        return jsonify({'error': 'Failed to fetch climate data'}), 500
    
    return jsonify(data)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)