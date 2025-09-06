class ClimateExplorer {
    constructor() {
        this.map = null;
        this.currentChart = null;
        this.currentLocation = null;
        this.weatherData = null;
        this.refreshInterval = null;
        
        this.initializeApp();
        this.setupEventListeners();
        this.setupGlobe();
        this.setupAutoRefresh();
    }
    
    initializeApp() {
        // Initialize map
        this.initializeMap();
        
        // Set default chart type
        this.currentChartType = 'temperature';
    }
    
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn));
        });
        
        // Chart tabs
        document.querySelectorAll('.chart-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchChart(btn));
        });
        
        // City search
        const citySearch = document.getElementById('citySearch');
        let searchTimeout;
        citySearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchCities(e.target.value);
            }, 300);
        });
        
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });
        
        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });
        
        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => {
            this.retryLastRequest();
        });
        
        // Click outside search results to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('cityResults').classList.remove('show');
            }
        });
    }
    
    switchTab(btn) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
        
        // Initialize map if map tab is selected
        if (btn.dataset.tab === 'map' && this.map) {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }
    
    switchChart(btn) {
        document.querySelectorAll('.chart-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.currentChartType = btn.dataset.chart;
        this.updateChart();
    }
    
    initializeMap() {
        // Initialize map in map tab
        setTimeout(() => {
            this.map = L.map('map').setView([20, 0], 2);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                className: 'dark-tiles'
            }).addTo(this.map);
            
            this.map.on('click', (e) => {
                this.selectLocationFromMap(e.latlng.lat, e.latlng.lng);
            });
        }, 100);
    }
    
    setupGlobe() {
        const earth = document.getElementById('earth');
        const tooltip = document.getElementById('tooltip');
        
        const earthWidth = 250;
        const earthHeight = 250;
        const textureWidth = 500;
        const textureHeight = 250;
        
        let isDragging = false;
        let wasDragging = false;
        let previousMouseX = 0;
        let bgPosX = 0;
        let velocityX = 0;
        let momentumID;
        
        earth.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            wasDragging = false;
            previousMouseX = e.clientX;
            cancelAnimationFrame(momentumID);
        });
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            wasDragging = true;
            const deltaX = e.clientX - previousMouseX;
            previousMouseX = e.clientX;
            velocityX = deltaX * 1.5;
            bgPosX = (((bgPosX + deltaX) % textureWidth) + textureWidth) % textureWidth;
            earth.style.backgroundPositionX = `-${bgPosX}px`;
        });
        
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.beginMomentumTracking();
            }
        });
        
        earth.addEventListener('click', (e) => {
            if (wasDragging) return;
            
            const rect = earth.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            const xFromCenter = clickX - (earthWidth / 2);
            const yFromCenter = clickY - (earthHeight / 2);
            if (Math.sqrt(xFromCenter**2 + yFromCenter**2) > (earthWidth / 2)) {
                return;
            }
            
            const mapPixelX = (bgPosX + clickX) % textureWidth;
            const longitude = (mapPixelX / textureWidth) * 360 - 180;
            const latitude = 90 - (clickY / textureHeight) * 180;
            
            this.selectLocationFromCoords(latitude, longitude);
        });
        
        this.beginMomentumTracking = () => {
            cancelAnimationFrame(momentumID);
            momentumID = requestAnimationFrame(() => {
                velocityX *= 0.95;
                bgPosX = (((bgPosX + velocityX) % textureWidth) + textureWidth) % textureWidth;
                earth.style.backgroundPositionX = `-${bgPosX}px`;
                if (Math.abs(velocityX) > 0.5) {
                    this.beginMomentumTracking();
                }
            });
        };
    }
    
    async searchCities(query) {
        if (query.length < 2) {
            document.getElementById('cityResults').classList.remove('show');
            return;
        }
        
        try {
            const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
            const cities = await response.json();
            
            this.displayCityResults(cities);
        } catch (error) {
            console.error('Error searching cities:', error);
        }
    }
    
    displayCityResults(cities) {
        const resultsContainer = document.getElementById('cityResults');
        
        if (cities.length === 0) {
            resultsContainer.classList.remove('show');
            return;
        }
        
        resultsContainer.innerHTML = cities.map(city => 
            `<div class="search-result-item" data-city="${JSON.stringify(city).replace(/"/g, '&quot;')}">
                <strong>${city.name}</strong>${city.state ? `, ${city.state}` : ''}, ${city.country}
            </div>`
        ).join('');
        
        resultsContainer.classList.add('show');
        
        // Add click handlers
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const cityData = JSON.parse(item.dataset.city.replace(/&quot;/g, '"'));
                this.selectCity(cityData);
                resultsContainer.classList.remove('show');
                document.getElementById('citySearch').value = `${cityData.name}, ${cityData.country}`;
            });
        });
    }
    
    selectCity(cityData) {
        this.loadWeatherData({ city: `${cityData.name}, ${cityData.country}` });
    }
    
    selectLocationFromMap(lat, lon) {
        this.loadWeatherData({ lat, lon });
    }
    
    selectLocationFromCoords(lat, lon) {
        this.loadWeatherData({ lat, lon });
    }
    
    async loadWeatherData(locationData) {
        this.showLoadingState();
        this.currentLocation = locationData;
        
        try {
            const response = await fetch('/api/weather', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(locationData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.weatherData = data;
            this.displayWeatherData(data);
            
        } catch (error) {
            console.error('Error loading weather data:', error);
            this.showErrorState(error.message);
        }
    }
    
    displayWeatherData(data) {
        this.hideLoadingState();
        this.hideErrorState();
        this.showDashboard();
        
        // Update location name and timestamp
        document.getElementById('locationName').textContent = data.location;
        document.getElementById('lastUpdated').textContent = 
            `Last updated: ${new Date(data.timestamp).toLocaleTimeString()}`;
        
        // Update current conditions
        document.getElementById('currentTemp').textContent = data.weather_data.current.temperature;
        document.getElementById('currentHumidity').textContent = data.weather_data.current.humidity;
        document.getElementById('currentAQI').textContent = data.weather_data.current_air.pm2_5;
        document.getElementById('currentWind').textContent = data.weather_data.current.windspeed;
        
        // Update AI summary
        document.getElementById('aiSummary').textContent = data.ai_summary;
        
        // Display anomalies
        this.displayAnomalies(data.anomalies);
        
        // Update charts
        this.updateChart();
        
        // Update forecast cards
        this.displayForecast(data.weather_data.daily);
    }
    
    displayAnomalies(anomalies) {
        const anomalySection = document.getElementById('anomalySection');
        const anomalyList = document.getElementById('anomalyList');
        
        if (anomalies.length === 0) {
            anomalySection.classList.add('hidden');
            return;
        }
        
        anomalySection.classList.remove('hidden');
        anomalyList.innerHTML = anomalies.map(anomaly => 
            `<div class="anomaly-item ${anomaly.severity}">
                <div class="anomaly-icon">${this.getAnomalyIcon(anomaly.type)}</div>
                <div class="anomaly-message">${anomaly.message}</div>
            </div>`
        ).join('');
    }
    
    getAnomalyIcon(type) {
        const icons = {
            extreme_heat: '🔥',
            extreme_cold: '❄️',
            air_quality: '😷',
            heavy_rain: '🌧️'
        };
        return icons[type] || '⚠️';
    }
    
    displayForecast(dailyData) {
        const forecastContainer = document.getElementById('forecastCards');
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        forecastContainer.innerHTML = dailyData.dates.slice(1, 8).map((date, index) => {
            const dateObj = new Date(date);
            const dayName = index === 0 ? 'Tomorrow' : days[dateObj.getDay()];
            const tempHigh = Math.round(dailyData.temp_max[index + 1]);
            const tempLow = Math.round(dailyData.temp_min[index + 1]);
            const precip = dailyData.precipitation_prob[index + 1];
            
            return `
                <div class="forecast-card">
                    <div class="forecast-date">${dayName}</div>
                    <div class="forecast-icon">${this.getWeatherIcon(tempHigh, precip)}</div>
                    <div class="forecast-temps">
                        <span class="temp-high">${tempHigh}°</span>
                        <span class="temp-low">${tempLow}°</span>
                    </div>
                    <div class="forecast-precip">${precip}% rain</div>
                </div>
            `;
        }).join('');
    }
    
    getWeatherIcon(temp, precip) {
        if (precip > 60) return '🌧️';
        if (precip > 30) return '⛅';
        if (temp > 30) return '☀️';
        if (temp < 10) return '❄️';
        return '🌤️';
    }
    
    updateChart() {
        if (!this.weatherData) return;
        
        const ctx = document.getElementById('mainChart').getContext('2d');
        
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        
        const chartData = this.getChartData();
        
        this.currentChart = new Chart(ctx, {
            type: chartData.type || 'line',
            data: chartData.data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#a0a6c1' },
                        grid: { color: '#2d3354' }
                    },
                    y: {
                        ticks: { color: '#a0a6c1' },
                        grid: { color: '#2d3354' }
                    }
                }
            }
        });
    }
    
    getChartData() {
        const data = this.weatherData.weather_data;
        
        switch (this.currentChartType) {
            case 'temperature':
                return {
                    type: 'line',
                    data: {
                        labels: data.hourly.timestamps.map(ts => new Date(ts).getHours() + ':00'),
                        datasets: [{
                            label: 'Temperature (°C)',
                            data: data.hourly.temperature,
                            borderColor: '#3f87ea',
                            backgroundColor: 'rgba(63, 135, 234, 0.1)',
                            tension: 0.4
                        }]
                    }
                };
            
            case 'precipitation':
                return {
                    type: 'bar',
                    data: {
                        labels: data.hourly.timestamps.map(ts => new Date(ts).getHours() + ':00'),
                        datasets: [{
                            label: 'Precipitation (mm)',
                            data: data.hourly.precipitation,
                            backgroundColor: '#22c55e'
                        }]
                    }
                };
            
            case 'air-quality':
                return {
                    type: 'line',
                    data: {
                        labels: data.hourly.timestamps.map(ts => new Date(ts).getHours() + ':00'),
                        datasets: [
                            {
                                label: 'PM2.5 (μg/m³)',
                                data: data.hourly.pm2_5,
                                borderColor: '#f59e0b',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)'
                            },
                            {
                                label: 'PM10 (μg/m³)',
                                data: data.hourly.pm10,
                                borderColor: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)'
                            }
                        ]
                    }
                };
            
            case 'forecast':
                return {
                    type: 'line',
                    data: {
                        labels: data.daily.dates.slice(0, 7),
                        datasets: [
                            {
                                label: 'Max Temp (°C)',
                                data: data.daily.temp_max.slice(0, 7),
                                borderColor: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)'
                            },
                            {
                                label: 'Min Temp (°C)',
                                data: data.daily.temp_min.slice(0, 7),
                                borderColor: '#3f87ea',
                                backgroundColor: 'rgba(63, 135, 234, 0.1)'
                            }
                        ]
                    }
                };
            
            default:
                return this.getChartData();
        }
    }
    // Add this method to the ClimateExplorer class after the existing getChartData method

    getChartData() {
        const data = this.weatherData.weather_data;
        
        switch (this.currentChartType) {
            case 'temperature':
                return {
                    type: 'line',
                    data: {
                        labels: data.hourly.timestamps.slice(0, 24).map(ts => new Date(ts).getHours() + ':00'),
                        datasets: [{
                            label: 'Temperature (°C)',
                            data: data.hourly.temperature.slice(0, 24),
                            borderColor: '#3f87ea',
                            backgroundColor: 'rgba(63, 135, 234, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    }
                };
            
            case 'precipitation':
                return {
                    type: 'bar',
                    data: {
                        labels: data.hourly.timestamps.slice(0, 24).map(ts => new Date(ts).getHours() + ':00'),
                        datasets: [{
                            label: 'Precipitation (mm)',
                            data: data.hourly.precipitation.slice(0, 24),
                            backgroundColor: '#22c55e'
                        }]
                    }
                };
            
            case 'air-quality':
                // Create heatmap-style visualization for air quality
                return this.createAirQualityHeatmap(data);
            
            case 'forecast':
                return {
                    type: 'line',
                    data: {
                        labels: data.daily.dates.slice(0, 7),
                        datasets: [
                            {
                                label: 'Max Temp (°C)',
                                data: data.daily.temp_max.slice(0, 7),
                                borderColor: '#ef4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                tension: 0.4
                            },
                            {
                                label: 'Min Temp (°C)',
                                data: data.daily.temp_min.slice(0, 7),
                                borderColor: '#3f87ea',
                                backgroundColor: 'rgba(63, 135, 234, 0.1)',
                                tension: 0.4
                            }
                        ]
                    }
                };
            
            default:
                return this.getChartData();
        }
    }

// Add this new method to create air quality heatmap
createAirQualityHeatmap(data) {
    // Get 24-hour data for better visualization
    const hours = data.hourly.timestamps.slice(0, 24).map(ts => {
        const date = new Date(ts);
        return date.getHours();
    });
    
    const pm25Data = data.hourly.pm2_5.slice(0, 24);
    const pm10Data = data.hourly.pm10.slice(0, 24);
    
    // Create background colors based on air quality levels
    const getAQIColor = (pm25) => {
        if (pm25 <= 12) return 'rgba(34, 197, 94, 0.8)';  // Good - Green
        if (pm25 <= 35) return 'rgba(245, 158, 11, 0.8)'; // Moderate - Yellow
        if (pm25 <= 55) return 'rgba(249, 115, 22, 0.8)'; // Unhealthy for Sensitive - Orange
        if (pm25 <= 150) return 'rgba(239, 68, 68, 0.8)'; // Unhealthy - Red
        return 'rgba(147, 51, 234, 0.8)'; // Hazardous - Purple
    };
    
    const backgroundColors = pm25Data.map(pm25 => getAQIColor(pm25));
    const borderColors = pm25Data.map(pm25 => getAQIColor(pm25).replace('0.8', '1'));
    
    return {
        type: 'bar',
        data: {
            labels: hours.map(h => h + ':00'),
            datasets: [
                {
                    label: 'PM2.5 Air Quality Index',
                    data: pm25Data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { 
                        color: '#ffffff',
                        generateLabels: function(chart) {
                            return [
                                { text: 'Good (0-12)', fillStyle: 'rgba(34, 197, 94, 0.8)' },
                                { text: 'Moderate (13-35)', fillStyle: 'rgba(245, 158, 11, 0.8)' },
                                { text: 'Unhealthy (36-55)', fillStyle: 'rgba(249, 115, 22, 0.8)' },
                                { text: 'Very Unhealthy (56-150)', fillStyle: 'rgba(239, 68, 68, 0.8)' },
                                { text: 'Hazardous (150+)', fillStyle: 'rgba(147, 51, 234, 0.8)' }
                            ];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const pm25 = context.raw;
                            if (pm25 <= 12) return 'Air Quality: Good';
                            if (pm25 <= 35) return 'Air Quality: Moderate';
                            if (pm25 <= 55) return 'Air Quality: Unhealthy for Sensitive Groups';
                            if (pm25 <= 150) return 'Air Quality: Unhealthy';
                            return 'Air Quality: Hazardous';
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#a0a6c1' },
                    grid: { color: '#2d3354' }
                },
                y: {
                    ticks: { color: '#a0a6c1' },
                    grid: { color: '#2d3354' },
                    title: {
                        display: true,
                        text: 'PM2.5 (μg/m³)',
                        color: '#ffffff'
                    }
                }
            }
        }
    };
}
    
    setupAutoRefresh() {
        this.refreshInterval = setInterval(() => {
            if (this.currentLocation) {
                this.refreshData();
            }
        }, 300000); // Refresh every 5 minutes
    }
    
    refreshData() {
        if (!this.currentLocation) return;
        
        const refreshIcon = document.querySelector('.refresh-icon');
        refreshIcon.classList.add('spinning');
        
        setTimeout(() => {
            refreshIcon.classList.remove('spinning');
        }, 1000);
        
        this.loadWeatherData(this.currentLocation);
    }
    
    exportData() {
        if (!this.weatherData) {
            alert('No data to export. Please select a location first.');
            return;
        }
        
        const exportData = {
            location: this.weatherData.location,
            timestamp: this.weatherData.timestamp,
            current_conditions: this.weatherData.weather_data.current,
            current_air_quality: this.weatherData.weather_data.current_air,
            forecast: this.weatherData.weather_data.daily,
            ai_summary: this.weatherData.ai_summary,
            anomalies: this.weatherData.anomalies
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `climate-data-${this.weatherData.location.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    retryLastRequest() {
        if (this.currentLocation) {
            this.loadWeatherData(this.currentLocation);
        }
    }
    
    showLoadingState() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('errorState').classList.add('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }
    
    hideLoadingState() {
        document.getElementById('loadingState').classList.add('hidden');
    }
    
    showErrorState(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }
    
    hideErrorState() {
        document.getElementById('errorState').classList.add('hidden');
    }
    
    showDashboard() {
        document.getElementById('dashboard').classList.remove('hidden');
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClimateExplorer();
});