class ClimateExplorer {
    constructor() {
        this.map = null;
        this.currentLocation = null;
        this.currentPeriod = 'today';
        this.charts = {};
        this.weatherData = null; // Store current weather data for chatbot
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.setupEventListeners();
        this.setupGlobe();
        this.setupMap();
    }
    
    setupEventListeners() {
        // Search functionality
        const citySearch = document.getElementById('citySearch');
        let searchTimeout;
        
        citySearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchCities(e.target.value);
            }, 300);
        });
        
        // Time period navigation
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.switchTimePeriod(btn.dataset.period);
            });
        });
        
        // Click outside search results to close
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                document.getElementById('searchResults').classList.remove('show');
            }
        });

        // Chatbot functionality
        this.setupChatbot();
    }
    
    async searchCities(query) {
        if (query.length < 2) {
            document.getElementById('searchResults').classList.remove('show');
            return;
        }
        
        try {
            const response = await fetch(`/api/search-cities?q=${encodeURIComponent(query)}`);
            const cities = await response.json();
            this.displaySearchResults(cities);
        } catch (error) {
            console.error('Error searching cities:', error);
        }
    }
    
    displaySearchResults(cities) {
        const resultsContainer = document.getElementById('searchResults');
        
        if (cities.length === 0) {
            resultsContainer.classList.remove('show');
            return;
        }
        
        resultsContainer.innerHTML = cities.map(city => 
            `<div class="search-result-item" data-lat="${city.lat}" data-lon="${city.lon}" data-name="${city.display_name}">
                <strong>${city.name}</strong>${city.state ? `, ${city.state}` : ''}, ${city.country}
            </div>`
        ).join('');
        
        resultsContainer.classList.add('show');
        
        // Add click handlers
        resultsContainer.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lon = parseFloat(item.dataset.lon);
                const name = item.dataset.name;
                
                this.selectLocation(lat, lon, name);
                resultsContainer.classList.remove('show');
                document.getElementById('citySearch').value = name;
            });
        });
    }
    
    setupGlobe() {
        // Initialize the fast-loading map-based circular globe
        setTimeout(() => {
            this.initializeCircularGlobe();
        }, 100);
    }

    initializeCircularGlobe() {
        const earthContainer = document.getElementById('earth');
        const mapContainer = document.getElementById('earth-map');
        const tooltip = document.getElementById('tooltip');
        
        // Initialize Leaflet map for circular globe view
        const globeMap = L.map('earth-map', {
            center: [20, 0],
            zoom: 2,
            minZoom: 1,
            maxZoom: 8,
            zoomControl: false,
            scrollWheelZoom: true,
            doubleClickZoom: false,
            dragging: true,
            worldCopyJump: false,
            maxBounds: [[-85, -180], [85, 180]],
            maxBoundsViscosity: 1.0
        });

        // Add fast-loading satellite tile layer
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 8,
            tileSize: 256,
            zoomOffset: 0,
            updateWhenIdle: false,
            keepBuffer: 2
        }).addTo(globeMap);

        // Rotation and interaction variables
        let rotationInterval;
        let isUserInteracting = false;
        let rotationSpeed = 0.3;
        let currentCenter = [20, 0];

        // Auto-rotation function
        const startRotation = () => {
            if (!isUserInteracting && rotationInterval === null) {
                rotationInterval = setInterval(() => {
                    currentCenter[1] += rotationSpeed;
                    if (currentCenter[1] > 180) currentCenter[1] = -180;
                    
                    globeMap.setView(currentCenter, globeMap.getZoom(), {
                        animate: false,
                        duration: 0.1
                    });
                }, 50);
            }
        };

        const stopRotation = () => {
            if (rotationInterval) {
                clearInterval(rotationInterval);
                rotationInterval = null;
            }
        };

        // Handle map interactions
        globeMap.on('dragstart zoomstart', () => {
            isUserInteracting = true;
            stopRotation();
        });

        globeMap.on('dragend zoomend', () => {
            currentCenter = [globeMap.getCenter().lat, globeMap.getCenter().lng];
            setTimeout(() => {
                isUserInteracting = false;
                startRotation();
            }, 2000);
        });

        globeMap.on('drag', () => {
            currentCenter = [globeMap.getCenter().lat, globeMap.getCenter().lng];
        });

        // Globe container hover effects
        earthContainer.addEventListener('mouseenter', () => {
            earthContainer.style.transform = 'scale(1.05)';
            rotationSpeed = 0.1; // Slow down rotation on hover
        });

        earthContainer.addEventListener('mouseleave', () => {
            earthContainer.style.transform = 'scale(1)';
            rotationSpeed = 0.3; // Resume normal speed
        });

        // Click to zoom functionality
        earthContainer.addEventListener('dblclick', (e) => {
            e.preventDefault();
            const currentZoom = globeMap.getZoom();
            if (currentZoom < 6) {
                globeMap.zoomIn(2);
            } else {
                globeMap.setZoom(2);
            }
        });

        // Store reference for location marker
        this.currentLocationMarker = null;

        // Click on map to select location
        globeMap.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            console.log(`Globe map click: lat=${lat.toFixed(2)}, lon=${lng.toFixed(2)}`);
            
            // Remove previous location marker if it exists
            if (this.currentLocationMarker) {
                globeMap.removeLayer(this.currentLocationMarker);
            }
            
            // Add red dot marker at clicked location
            this.currentLocationMarker = L.circleMarker([lat, lng], {
                radius: 8,
                fillColor: '#ff0000',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(globeMap);
            
            // Add CSS class for proper animation instead of inline style
            setTimeout(() => {
                const markerElement = this.currentLocationMarker.getElement();
                if (markerElement) {
                    markerElement.classList.add('location-marker-pulse');
                }
            }, 100);
            this.currentLocationMarker.bindTooltip('Selected Location', {
                permanent: false,
                direction: 'top',
                className: 'location-marker-tooltip'
            });
            
            // Show tooltip at cursor position
            const containerRect = earthContainer.getBoundingClientRect();
            const tooltipX = e.containerPoint.x + containerRect.left;
            const tooltipY = e.containerPoint.y + containerRect.top;
            
            this.selectLocationFromCoords(lat, lng, tooltipX, tooltipY);
        });

        // Weather markers functionality for the globe
        this.addWeatherMarkerToGlobe = (lat, lng, cityName, weatherData) => {
            const marker = L.circleMarker([lat, lng], {
                radius: 6,
                fillColor: this.getWeatherColor(weatherData.weather[0].main),
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(globeMap);
            
            const temp = Math.round(weatherData.main.temp - 273.15);
            const weatherIcon = this.getWeatherEmoji(weatherData.weather[0].main);
            
            marker.bindPopup(`
                <div class="globe-weather-popup">
                    <h4>${cityName}</h4>
                    <div class="weather-summary">
                        <span class="weather-emoji">${weatherIcon}</span>
                        <span class="temp">${temp}°C</span>
                    </div>
                    <p>${weatherData.weather[0].description}</p>
                    <div class="weather-details">
                        <small>💧 ${weatherData.main.humidity}%</small>
                        <small>💨 ${Math.round(weatherData.wind?.speed * 3.6 || 0)} km/h</small>
                    </div>
                </div>
            `, {
                className: 'globe-popup'
            });
            
            return marker;
        };

        // Utility functions for weather visualization
        this.getWeatherColor = (weatherMain) => {
            const colorMap = {
                'Clear': '#ffd700',
                'Clouds': '#87ceeb',
                'Rain': '#4682b4',
                'Drizzle': '#6495ed',
                'Thunderstorm': '#483d8b',
                'Snow': '#f0f8ff',
                'Mist': '#b0c4de',
                'Fog': '#708090',
                'Haze': '#dda0dd'
            };
            return colorMap[weatherMain] || '#90ee90';
        };

        this.getWeatherEmoji = (weatherMain) => {
            const emojiMap = {
                'Clear': '☀️',
                'Clouds': '☁️',
                'Rain': '🌧️',
                'Drizzle': '🌦️',
                'Thunderstorm': '⛈️',
                'Snow': '❄️',
                'Mist': '🌫️',
                'Fog': '🌫️',
                'Haze': '🌫️'
            };
            return emojiMap[weatherMain] || '🌤️';
        };

        // Store globe map reference for later use
        this.globeMap = globeMap;

        // Start rotation after initialization
        setTimeout(() => {
            startRotation();
        }, 1000);

        console.log('Fast-loading circular globe initialized with map tiles');
    }

    // Method to add location marker to both maps
    addLocationMarker(lat, lon, showAnimation = true) {
        // Add marker to globe map
        if (this.globeMap) {
            if (this.currentLocationMarker) {
                this.globeMap.removeLayer(this.currentLocationMarker);
            }
            
            this.currentLocationMarker = L.circleMarker([lat, lon], {
                radius: 8,
                fillColor: '#ff0000',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(this.globeMap);
            
            this.currentLocationMarker.bindTooltip('Selected Location', {
                permanent: false,
                direction: 'top',
                className: 'location-marker-tooltip'
            });
            
            if (showAnimation) {
                setTimeout(() => {
                    const markerElement = this.currentLocationMarker.getElement();
                    if (markerElement) {
                        markerElement.classList.add('location-marker-pulse');
                    }
                }, 100);
            }
        }
        
        // Add marker to main map
        if (this.map) {
            if (this.currentMapLocationMarker) {
                this.map.removeLayer(this.currentMapLocationMarker);
            }
            
            this.currentMapLocationMarker = L.circleMarker([lat, lon], {
                radius: 8,
                fillColor: '#ff0000',
                color: '#ffffff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }).addTo(this.map);
            
            this.currentMapLocationMarker.bindTooltip('Selected Location', {
                permanent: false,
                direction: 'top',
                className: 'location-marker-tooltip'
            });
            
            if (showAnimation) {
                setTimeout(() => {
                    const markerElement = this.currentMapLocationMarker.getElement();
                    if (markerElement) {
                        markerElement.classList.add('location-marker-pulse');
                    }
                }, 100);
            }
            
            // Center the main map on the new location
            this.map.setView([lat, lon], Math.max(this.map.getZoom(), 6));
        }
    }
    
    setupMap() {
        setTimeout(() => {
            this.map = L.map('map').setView([20, 0], 2);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            // Store reference for location marker on main map too
            this.currentMapLocationMarker = null;
            
            this.map.on('click', (e) => {
                console.log(`Map click: lat=${e.latlng.lat.toFixed(2)}, lon=${e.latlng.lng.toFixed(2)}`);
                
                // Remove previous location marker if it exists
                if (this.currentMapLocationMarker) {
                    this.map.removeLayer(this.currentMapLocationMarker);
                }
                
                // Add red dot marker at clicked location
                this.currentMapLocationMarker = L.circleMarker([e.latlng.lat, e.latlng.lng], {
                    radius: 8,
                    fillColor: '#ff0000',
                    color: '#ffffff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                }).addTo(this.map);
                
                // Add CSS class for proper animation instead of inline style
                setTimeout(() => {
                    const markerElement = this.currentMapLocationMarker.getElement();
                    if (markerElement) {
                        markerElement.classList.add('location-marker-pulse');
                    }
                }, 100);
                
                // Add tooltip
                this.currentMapLocationMarker.bindTooltip('Selected Location', {
                    permanent: false,
                    direction: 'top',
                    className: 'location-marker-tooltip'
                });
                
                this.selectLocationFromCoords(e.latlng.lat, e.latlng.lng);
            });
        }, 100);
    }
    
    async selectLocationFromCoords(lat, lon, cursorX = null, cursorY = null) {
        try {
            // Show loading tooltip if coordinates provided
            if (cursorX && cursorY) {
                this.updateTooltip("Loading...", cursorX, cursorY);
            }
            
            // Try BigDataCloud API for better location names
            let locationName = "Unknown Location";
            try {
                const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                const data = await response.json();
                
                if (data.city) {
                    locationName = `${data.city}, ${data.countryName}`;
                } else if (data.principalSubdivision) {
                    locationName = `${data.principalSubdivision}, ${data.countryName}`;
                } else if (data.countryName) {
                    locationName = data.countryName;
                } else {
                    locationName = "Ocean";
                }
            } catch (error) {
                console.warn('BigDataCloud API failed, falling back to backend:', error);
                // Fallback to our backend API
                try {
                    const response = await fetch(`/api/location-from-coords?lat=${lat}&lon=${lon}`);
                    const location = await response.json();
                    locationName = location.display_name;
                } catch (backendError) {
                    console.error('Backend API also failed:', backendError);
                    locationName = `Location (${lat.toFixed(2)}, ${lon.toFixed(2)})`;
                }
            }
            
            // Update tooltip with location name if showing
            if (cursorX && cursorY) {
                this.updateTooltip(locationName, cursorX, cursorY);
                setTimeout(() => {
                    document.getElementById('tooltip').style.opacity = '0';
                }, 3000);
            }
            
            this.selectLocation(lat, lon, locationName);
            
        } catch (error) {
            console.error('Error getting location:', error);
            if (cursorX && cursorY) {
                this.updateTooltip("Could not fetch location", cursorX, cursorY);
                setTimeout(() => {
                    document.getElementById('tooltip').style.opacity = '0';
                }, 2000);
            }
        }
    }
    
    updateTooltip(text, x, y) {
        const tooltip = document.getElementById('tooltip');
        tooltip.textContent = text;
        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y}px`;
        tooltip.style.opacity = '1';
    }
    
    selectLocation(lat, lon, displayName) {
        this.currentLocation = { lat, lon, name: displayName };
        
        // Update UI
        document.getElementById('locationName').textContent = displayName;
        document.getElementById('coordinates').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        
        // Add location markers to both maps
        this.addLocationMarker(lat, lon, true);
        
        // Load climate data for current period
        this.loadClimateData();
        
        // Show dashboard
        document.getElementById('dashboard').classList.remove('hidden');
    }
    
    switchTimePeriod(period) {
        // Update active button
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-period="${period}"]`).classList.add('active');
        
        this.currentPeriod = period;
        
        // Show/hide current conditions (only for today)
        const currentConditions = document.getElementById('currentConditions');
        if (period === 'today') {
            currentConditions.style.display = 'block';
        } else {
            currentConditions.style.display = 'none';
        }
        
        // Update chart titles
        this.updateChartTitles(period);
        
        // Load new data
        if (this.currentLocation) {
            this.loadClimateData();
        }
    }
    
    updateChartTitles(period) {
        const titles = {
            'today': {
                temp: 'Today\'s Temperature (Hourly)',
                precip: 'Today\'s Rainfall (Hourly)',
                air: 'Today\'s Air Quality (Hourly)',
                heatmap: 'Today\'s Air Quality Heatmap'
            },
            '7days': {
                temp: 'Temperature (Last 7 Days)',
                precip: 'Rainfall (Last 7 Days)',
                air: 'Air Quality (Last 7 Days)',
                heatmap: 'Air Quality Heatmap (7 Days)'
            },
            '30days': {
                temp: 'Temperature (Last 30 Days - Weekly)',
                precip: 'Rainfall (Last 30 Days - Weekly)',
                air: 'Air Quality (Last 30 Days - Weekly)',
                heatmap: 'Air Quality Heatmap (30 Days)'
            }
        };
        
        document.getElementById('tempChartTitle').textContent = titles[period].temp;
        document.getElementById('precipChartTitle').textContent = titles[period].precip;
        document.getElementById('airChartTitle').textContent = titles[period].air;
        document.getElementById('heatmapTitle').textContent = titles[period].heatmap;
    }
    
    async loadClimateData() {
        if (!this.currentLocation) return;
        
        this.showLoading();
        
        try {
            const response = await fetch(
                `/api/climate-data?lat=${this.currentLocation.lat}&lon=${this.currentLocation.lon}&period=${this.currentPeriod}`
            );
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.displayClimateData(data);
        } catch (error) {
            console.error('Error loading climate data:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    displayClimateData(data) {
        // Store data for chatbot access
        this.weatherData = data;
        console.log('Weather data stored for chatbot:', this.weatherData);
        console.log('Current location:', this.currentLocation);
        
        // Update current conditions (if today)
        if (data.period === 'today' && data.current) {
            document.getElementById('currentTemp').textContent = data.current.temperature;
            document.getElementById('currentHumidity').textContent = data.current.humidity;
            document.getElementById('currentPM25').textContent = data.current.pm25;
            document.getElementById('currentWind').textContent = data.current.windspeed;
        }
        
        // Create charts based on period
        this.createCharts(data);
        
        // Update chatbot with new data
        this.updateChatbotContext();
    }
    
    createCharts(data) {
        // Destroy existing charts
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
        
        switch (data.period) {
            case 'today':
                this.createTodayCharts(data);
                break;
            case '7days':
                this.create7DayCharts(data);
                break;
            case '30days':
                this.create30DayCharts(data);
                break;
        }
    }
    
    createTodayCharts(data) {
        const hourly = data.hourly;
        
        // Temperature Chart
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: hourly.hours.map(h => `${h}:00`),
                datasets: [{
                    label: 'Temperature (°C)',
                    data: hourly.temperature,
                    borderColor: '#3f87ea',
                    backgroundColor: 'rgba(63, 135, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: this.getChartOptions()
        });
        
        // Precipitation Chart
        const precipCtx = document.getElementById('precipitationChart').getContext('2d');
        this.charts.precipitation = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: hourly.hours.map(h => `${h}:00`),
                datasets: [{
                    label: 'Rainfall (mm)',
                    data: hourly.precipitation,
                    backgroundColor: '#22c55e'
                }]
            },
            options: this.getChartOptions()
        });
        
        // Air Quality Chart
        const airCtx = document.getElementById('airQualityChart').getContext('2d');
        this.charts.airQuality = new Chart(airCtx, {
            type: 'line',
            data: {
                labels: hourly.hours.map(h => `${h}:00`),
                datasets: [
                    {
                        label: 'PM2.5',
                        data: hourly.pm25,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)'
                    },
                    {
                        label: 'PM10',
                        data: hourly.pm10,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    }
                ]
            },
            options: this.getChartOptions()
        });
        
        // Air Quality Heatmap
        this.createAirQualityHeatmap(hourly.hours.map(h => `${h}:00`), hourly.pm25);
    }
    
    create7DayCharts(data) {
        const daily = data.daily;
        
        // Temperature Chart
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: daily.day_names,
                datasets: [
                    {
                        label: 'Max Temp (°C)',
                        data: daily.temp_max,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    },
                    {
                        label: 'Min Temp (°C)',
                        data: daily.temp_min,
                        borderColor: '#3f87ea',
                        backgroundColor: 'rgba(63, 135, 234, 0.1)'
                    }
                ]
            },
            options: this.getChartOptions()
        });
        
        // Precipitation Chart
        const precipCtx = document.getElementById('precipitationChart').getContext('2d');
        this.charts.precipitation = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: daily.day_names,
                datasets: [{
                    label: 'Rainfall (mm)',
                    data: daily.precipitation,
                    backgroundColor: '#22c55e'
                }]
            },
            options: this.getChartOptions()
        });
        
        // Air Quality Chart
        const airCtx = document.getElementById('airQualityChart').getContext('2d');
        this.charts.airQuality = new Chart(airCtx, {
            type: 'bar',
            data: {
                labels: daily.day_names,
                datasets: [
                    {
                        label: 'PM2.5',
                        data: daily.pm25,
                        backgroundColor: '#f59e0b'
                    },
                    {
                        label: 'PM10',
                        data: daily.pm10,
                        backgroundColor: '#ef4444'
                    }
                ]
            },
            options: this.getChartOptions()
        });
        
        // Heatmap
        this.createAirQualityHeatmap(daily.day_names, daily.pm25);
    }
    
    create30DayCharts(data) {
        const weekly = data.weekly;
        
        // Temperature Chart
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: weekly.weeks,
                datasets: [
                    {
                        label: 'Max Temp (°C)',
                        data: weekly.temp_max,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    },
                    {
                        label: 'Min Temp (°C)',
                        data: weekly.temp_min,
                        borderColor: '#3f87ea',
                        backgroundColor: 'rgba(63, 135, 234, 0.1)'
                    }
                ]
            },
            options: this.getChartOptions()
        });
        
        // Precipitation Chart
        const precipCtx = document.getElementById('precipitationChart').getContext('2d');
        this.charts.precipitation = new Chart(precipCtx, {
            type: 'bar',
            data: {
                labels: weekly.weeks,
                datasets: [{
                    label: 'Rainfall (mm)',
                    data: weekly.precipitation,
                    backgroundColor: '#22c55e'
                }]
            },
            options: this.getChartOptions()
        });
        
        // Air Quality Chart
        const airCtx = document.getElementById('airQualityChart').getContext('2d');
        this.charts.airQuality = new Chart(airCtx, {
            type: 'bar',
            data: {
                labels: weekly.weeks,
                datasets: [
                    {
                        label: 'PM2.5',
                        data: weekly.pm25,
                        backgroundColor: '#f59e0b'
                    },
                    {
                        label: 'PM10',
                        data: weekly.pm10,
                        backgroundColor: '#ef4444'
                    }
                ]
            },
            options: this.getChartOptions()
        });
        
        // Heatmap
        this.createAirQualityHeatmap(weekly.weeks, weekly.pm25);
    }
    
    createAirQualityHeatmap(labels, pm25Data) {
        const ctx = document.getElementById('heatmapChart').getContext('2d');
        
        // Ensure PM2.5 data is valid numbers
        const validPM25Data = pm25Data.map(value => {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        });
        
        console.log('PM2.5 Data for heatmap:', validPM25Data); // Debug log
        
        // Create color-coded background colors based on AQI levels
        const getAQIColor = (pm25) => {
            if (pm25 <= 12) return 'rgba(34, 197, 94, 0.8)';  // Good - Green
            if (pm25 <= 35) return 'rgba(245, 158, 11, 0.8)'; // Moderate - Yellow
            if (pm25 <= 55) return 'rgba(249, 115, 22, 0.8)'; // Unhealthy for Sensitive - Orange
            if (pm25 <= 150) return 'rgba(239, 68, 68, 0.8)'; // Unhealthy - Red
            return 'rgba(147, 51, 234, 0.8)'; // Hazardous - Purple
        };
        
        const backgroundColors = validPM25Data.map(pm25 => getAQIColor(pm25));
        const borderColors = validPM25Data.map(pm25 => getAQIColor(pm25).replace('0.8', '1'));
        
        console.log('Background colors:', backgroundColors); // Debug log
        
        this.charts.heatmap = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PM2.5 Air Quality Index',
                    data: validPM25Data,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 2,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
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
        });
        
        // Add properly formatted legend
        this.addHeatmapLegend();
    }
    
    addHeatmapLegend() {
        const legendContainer = document.getElementById('heatmapLegend');
        
        if (!legendContainer) {
            console.error('Heatmap legend container not found!');
            return;
        }
        
        legendContainer.innerHTML = `
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgba(34, 197, 94, 0.8);"></div>
                <span>Good (0-12)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgba(245, 158, 11, 0.8);"></div>
                <span>Moderate (13-35)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgba(249, 115, 22, 0.8);"></div>
                <span>Unhealthy for Sensitive (36-55)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgba(239, 68, 68, 0.8);"></div>
                <span>Very Unhealthy (56-150)</span>
            </div>
            <div class="legend-item">
                <div class="legend-color" style="background-color: rgba(147, 51, 234, 0.8);"></div>
                <span>Hazardous (150+)</span>
            </div>
        `;
        
        console.log('Heatmap legend added successfully'); // Debug log
    }
    
    getChartOptions() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { 
                        color: '#ffffff',
                        padding: 20,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: '#2d3354',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: { 
                        color: '#a0a6c1',
                        font: {
                            size: 11
                        }
                    },
                    grid: { 
                        color: '#2d3354',
                        drawBorder: false
                    }
                },
                y: {
                    ticks: { 
                        color: '#a0a6c1',
                        font: {
                            size: 11
                        }
                    },
                    grid: { 
                        color: '#2d3354',
                        drawBorder: false
                    }
                }
            }
        };
    }
    
    showLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
    }

    // Chatbot functionality
    setupChatbot() {
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendChatBtn');

        // Send message on button click
        sendBtn.addEventListener('click', () => {
            this.sendChatMessage();
        });

        // Send message on Enter key
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendChatMessage();
            }
        });
    }

    async sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;

        // Add user message to chat
        this.addMessageToChat(message, 'user');
        
        // Clear input
        chatInput.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Send to Gemini AI and wait for response
        try {
            const aiResponse = await this.sendToGeminiAI(message);
            
            // Remove typing indicator
            this.hideTypingIndicator();
            
            // Add AI response to chat
            this.addMessageToChat(aiResponse, 'bot');
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.hideTypingIndicator();
            this.addMessageToChat('Sorry, I encountered an error processing your request.', 'bot');
        }
    }

    async sendToGeminiAI(message) {
        console.log('Sending to Gemini AI:', message);
        console.log('Weather data available:', !!this.weatherData);
        console.log('Current location available:', !!this.currentLocation);
        
        // Enhanced payload with better context
        const payload = {
            message: message.trim(),
            weather_data: this.weatherData || null,
            location: this.currentLocation || null,
            context: {
                currentPeriod: this.currentPeriod,
                hasData: !!this.weatherData,
                timestamp: new Date().toISOString()
            }
        };
        
        console.log('Enhanced payload being sent:', payload);
        
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response from server:', data);
            return data.response || 'Sorry, I could not process your request.';
        } catch (error) {
            console.error('Error communicating with chatbot:', error);
            // Friendly fallback responses
            const fallbackResponses = [
                "I'm having a connection issue right now. Try asking me about the weather again!",
                "Oops, something went wrong on my end. What would you like to know about the weather?",
                "I'm temporarily unavailable, but I'll be back soon to help with your weather questions!"
            ];
            return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }
    }

    addMessageToChat(message, sender) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = message;
        
        messageDiv.appendChild(contentDiv);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showTypingIndicator() {
        const chatMessages = document.getElementById('chatMessages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message bot-message typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        typingDiv.innerHTML = `
            <div class="message-content">
                <span>Climate Assistant is typing</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        chatMessages.appendChild(typingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    updateChatbotContext() {
        // This method is called whenever new weather data is loaded
        // The enhanced AI backend now handles all the context processing
        console.log('Chatbot context updated with new weather data');
        
        // Add welcome message if chat is empty and we have location data
        if (this.weatherData && this.currentLocation) {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages && chatMessages.children.length === 0) {
                this.addMessageToChat(
                    `� Hello! I'm your weather assistant for ${this.currentLocation.name}. I can help you understand the current conditions, forecasts, air quality, and provide weather advice. What would you like to know?`, 
                    'bot'
                );
            }
        }
    }
}

// Initialize the application when DOM is loaded
let climateExplorer;
document.addEventListener('DOMContentLoaded', () => {
    climateExplorer = new ClimateExplorer();
});