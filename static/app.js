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
        const earth = document.getElementById('earth');
        const tooltip = document.getElementById('tooltip');
        
        // Define texture and view dimensions
        const earthWidth = 300;
        const earthHeight = 300;
        const textureWidth = 600;
        const textureHeight = 300;

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
            this.cancelMomentumTracking();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            wasDragging = true;
            const deltaX = e.clientX - previousMouseX;
            previousMouseX = e.clientX;
            velocityX = deltaX * 1.5;
            // Use a proper modulo for negative numbers
            bgPosX = (((bgPosX + deltaX) % textureWidth) + textureWidth) % textureWidth;
            earth.style.backgroundPositionX = `-${bgPosX}px`;
        });
        
        window.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.beginMomentumTracking();
            }
        });

        // Improved click logic for better coordinate calculation
        earth.addEventListener('click', (e) => {
            if(wasDragging) return;

            const rect = earth.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Ignore clicks outside the circle
            const xFromCenter = clickX - (earthWidth / 2);
            const yFromCenter = clickY - (earthHeight / 2);
            if (Math.sqrt(xFromCenter**2 + yFromCenter**2) > (earthWidth / 2)) {
                return;
            }

            // Find the horizontal pixel on the flat map texture
            const mapPixelX = (bgPosX + clickX) % textureWidth;
            
            // Convert pixel coordinates to Latitude and Longitude (for equirectangular map)
            // Longitude: Ranges from -180 to 180
            const longitude = (mapPixelX / textureWidth) * 360 - 180;
            // Latitude: Ranges from 90 to -90
            const latitude = 90 - (clickY / textureHeight) * 180;
            
            console.log(`Globe click: lat=${latitude.toFixed(2)}, lon=${longitude.toFixed(2)}`);
            this.selectLocationFromCoords(latitude, longitude, e.clientX, e.clientY);
        });

        // Set up momentum tracking methods
        this.cancelMomentumTracking = () => {
            cancelAnimationFrame(momentumID);
        };

        this.beginMomentumTracking = () => {
            this.cancelMomentumTracking();
            momentumID = requestAnimationFrame(() => this.momentumLoop());
        };

        this.momentumLoop = () => {
            velocityX *= 0.95;
            bgPosX = (((bgPosX + velocityX) % textureWidth) + textureWidth) % textureWidth;
            earth.style.backgroundPositionX = `-${bgPosX}px`;
            if (Math.abs(velocityX) > 0.5) {
                momentumID = requestAnimationFrame(() => this.momentumLoop());
            }
        };
    }
    
    setupMap() {
        setTimeout(() => {
            this.map = L.map('map').setView([20, 0], 2);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            this.map.on('click', (e) => {
                console.log(`Map click: lat=${e.latlng.lat.toFixed(2)}, lon=${e.latlng.lng.toFixed(2)}`);
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
        
        const payload = {
            message: message,
            weather_data: this.weatherData || null,
            location: this.currentLocation || null
        };
        
        console.log('Payload being sent:', payload);
        
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
            return 'Sorry, there was an error processing your request.';
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

    processUserQuestion(question) {
        const lowerQuestion = question.toLowerCase();
        const currentData = this.weatherData;
        
        if (!currentData) {
            return "🤔 I don't have any climate data to analyze yet. Please select a location first by searching for a city or clicking on the globe/map!";
        }

        // Location-based questions
        if (lowerQuestion.includes('location') || lowerQuestion.includes('where')) {
            return `📍 You're currently viewing data for ${this.currentLocation.name}. The coordinates are ${this.currentLocation.lat.toFixed(2)}, ${this.currentLocation.lon.toFixed(2)}.`;
        }

        // Current conditions questions
        if (lowerQuestion.includes('current') || lowerQuestion.includes('now') || lowerQuestion.includes('today')) {
            if (currentData.current) {
                const current = currentData.current;
                return `🌡️ **Current Conditions:**\n• Temperature: ${current.temperature}°C\n• Humidity: ${current.humidity}%\n• PM2.5: ${current.pm25} μg/m³ ${this.getAirQualityDescription(current.pm25)}\n• Wind Speed: ${current.windspeed} km/h\n\n${this.getWeatherAdvice(current)}`;
            }
        }

        // Temperature questions
        if (lowerQuestion.includes('temperature') || lowerQuestion.includes('temp') || lowerQuestion.includes('hot') || lowerQuestion.includes('cold')) {
            return this.answerTemperatureQuestion(currentData, lowerQuestion);
        }

        // Air quality questions
        if (lowerQuestion.includes('air') || lowerQuestion.includes('pollution') || lowerQuestion.includes('pm2.5') || lowerQuestion.includes('pm10')) {
            return this.answerAirQualityQuestion(currentData, lowerQuestion);
        }

        // Weather/precipitation questions
        if (lowerQuestion.includes('rain') || lowerQuestion.includes('weather') || lowerQuestion.includes('precipitation') || lowerQuestion.includes('wet')) {
            return this.answerWeatherQuestion(currentData, lowerQuestion);
        }

        // Wind questions
        if (lowerQuestion.includes('wind') || lowerQuestion.includes('windy')) {
            return this.answerWindQuestion(currentData, lowerQuestion);
        }

        // Trend questions
        if (lowerQuestion.includes('trend') || lowerQuestion.includes('pattern') || lowerQuestion.includes('change')) {
            return this.answerTrendQuestion(currentData, lowerQuestion);
        }

        // Health questions
        if (lowerQuestion.includes('health') || lowerQuestion.includes('safe') || lowerQuestion.includes('exercise') || lowerQuestion.includes('outdoor')) {
            return this.answerHealthQuestion(currentData, lowerQuestion);
        }

        // Best/worst questions
        if (lowerQuestion.includes('best') || lowerQuestion.includes('worst') || lowerQuestion.includes('highest') || lowerQuestion.includes('lowest')) {
            return this.answerBestWorstQuestion(currentData, lowerQuestion);
        }

        // Default response with suggestions
        return `🤖 I can help you understand the climate data! Try asking me about:
        
📊 **Data Questions:**
• "What's the current temperature?"
• "How's the air quality today?"
• "Is it going to rain?"
• "What are the temperature trends?"

🏥 **Health & Safety:**
• "Is it safe to exercise outside?"
• "When is the best air quality today?"
• "Should I wear a mask today?"

📈 **Analysis:**
• "What's the highest temperature this week?"
• "How does today compare to yesterday?"
• "What time has the cleanest air?"

Just ask me anything about your weather dashboard! 🌤️`;
    }

    answerTemperatureQuestion(data, question) {
        if (data.period === 'today' && data.current) {
            const current = data.current;
            const hourly = data.hourly;
            const maxTemp = Math.max(...hourly.temperature);
            const minTemp = Math.min(...hourly.temperature);
            const maxHour = hourly.hours[hourly.temperature.indexOf(maxTemp)];
            const minHour = hourly.hours[hourly.temperature.indexOf(minTemp)];

            return `🌡️ **Temperature Analysis:**\n• Current: ${current.temperature}°C\n• Today's Range: ${minTemp}°C to ${maxTemp}°C\n• Warmest: ${maxHour}:00 (${maxTemp}°C)\n• Coolest: ${minHour}:00 (${minTemp}°C)\n\n${this.getTemperatureAdvice(current.temperature, maxTemp, minTemp)}`;
        } else if (data.period === '7days') {
            const daily = data.daily;
            const maxTemp = Math.max(...daily.temp_max);
            const minTemp = Math.min(...daily.temp_min);
            return `🌡️ **7-Day Temperature:**\n• Highest: ${maxTemp}°C\n• Lowest: ${minTemp}°C\n• Average High: ${(daily.temp_max.reduce((a,b) => a+b) / daily.temp_max.length).toFixed(1)}°C\n• Average Low: ${(daily.temp_min.reduce((a,b) => a+b) / daily.temp_min.length).toFixed(1)}°C`;
        }
        return "I can analyze temperature data once you select a location! 🌡️";
    }

    answerAirQualityQuestion(data, question) {
        if (data.current) {
            const pm25 = data.current.pm25;
            const description = this.getAirQualityDescription(pm25);
            const advice = this.getAirQualityAdvice(pm25);

            if (data.hourly) {
                const avgPM25 = (data.hourly.pm25.reduce((a,b) => a+b) / data.hourly.pm25.length).toFixed(1);
                const maxPM25 = Math.max(...data.hourly.pm25);
                const minPM25 = Math.min(...data.hourly.pm25);

                return `🌬️ **Air Quality Analysis:**\n• Current PM2.5: ${pm25} μg/m³ (${description})\n• Today's Range: ${minPM25} - ${maxPM25} μg/m³\n• Daily Average: ${avgPM25} μg/m³\n\n💡 **Health Advice:** ${advice}`;
            }
            return `🌬️ **Current Air Quality:**\n• PM2.5: ${pm25} μg/m³ (${description})\n\n💡 ${advice}`;
        }
        return "I need location data to analyze air quality! Please select a location first. 🌬️";
    }

    answerWeatherQuestion(data, question) {
        if (data.hourly) {
            const totalRain = data.hourly.precipitation.reduce((a,b) => a+b, 0);
            const maxRain = Math.max(...data.hourly.precipitation);
            const rainHours = data.hourly.precipitation.filter(p => p > 0).length;

            if (totalRain > 0) {
                return `🌧️ **Rainfall Today:**\n• Total: ${totalRain.toFixed(1)}mm\n• Peak: ${maxRain.toFixed(1)}mm/hour\n• Rainy hours: ${rainHours}/24\n\n☂️ You might want to carry an umbrella!`;
            } else {
                return `☀️ **Weather Today:**\n• No rain expected today!\n• Perfect weather for outdoor activities\n• Don't forget sunscreen! ☀️`;
            }
        }
        return "Select a location to get weather information! 🌤️";
    }

    answerWindQuestion(data, question) {
        if (data.current && data.hourly) {
            const currentWind = data.current.windspeed;
            const maxWind = Math.max(...data.hourly.windspeed);
            const avgWind = (data.hourly.windspeed.reduce((a,b) => a+b) / data.hourly.windspeed.length).toFixed(1);

            return `💨 **Wind Analysis:**\n• Current: ${currentWind} km/h\n• Today's Peak: ${maxWind} km/h\n• Average: ${avgWind} km/h\n\n${this.getWindAdvice(currentWind, maxWind)}`;
        }
        return "Wind data will be available after selecting a location! 💨";
    }

    answerTrendQuestion(data, question) {
        if (data.period === '7days' && data.daily) {
            const temps = data.daily.temp_max;
            const isWarming = temps[temps.length-1] > temps[0];
            const tempChange = (temps[temps.length-1] - temps[0]).toFixed(1);

            return `📈 **7-Day Trends:**\n• Temperature trend: ${isWarming ? '📈 Warming' : '📉 Cooling'} by ${Math.abs(tempChange)}°C\n• Air quality varies throughout the week\n• Check the charts for detailed patterns!`;
        }
        return "Switch to 7-day or 30-day view to see trends! 📊";
    }

    answerHealthQuestion(data, question) {
        if (data.current) {
            const temp = data.current.temperature;
            const pm25 = data.current.pm25;
            const wind = data.current.windspeed;

            let advice = "🏥 **Health Assessment:**\n";
            
            // Temperature health advice
            if (temp < 5) advice += "❄️ Very cold - dress warmly, limit outdoor exposure\n";
            else if (temp < 15) advice += "🧥 Cool - wear layers for outdoor activities\n";
            else if (temp < 25) advice += "👕 Comfortable for most outdoor activities\n";
            else if (temp < 35) advice += "🌡️ Warm - stay hydrated, seek shade\n";
            else advice += "🔥 Very hot - limit outdoor activities, stay cool\n";

            // Air quality health advice
            if (pm25 <= 12) advice += "✅ Good air quality - safe for all outdoor activities\n";
            else if (pm25 <= 35) advice += "⚠️ Moderate air - sensitive people should limit prolonged outdoor exertion\n";
            else if (pm25 <= 55) advice += "🚨 Unhealthy for sensitive groups - wear masks if sensitive\n";
            else advice += "☣️ Unhealthy air - everyone should limit outdoor activities\n";

            return advice + `\n💡 **Recommendation:** ${this.getOverallHealthAdvice(temp, pm25)}`;
        }
        return "I need current data to provide health advice! Select a location first. 🏥";
    }

    answerBestWorstQuestion(data, question) {
        if (data.hourly) {
            const temps = data.hourly.temperature;
            const pm25s = data.hourly.pm25;
            const hours = data.hourly.hours;

            const bestTempIdx = temps.findIndex(t => t >= 20 && t <= 25) || 0;
            const bestAirIdx = pm25s.indexOf(Math.min(...pm25s));
            const worstAirIdx = pm25s.indexOf(Math.max(...pm25s));

            return `🏆 **Best & Worst Times Today:**

✅ **Best Times:**
• Comfortable temperature: ${hours[bestTempIdx]}:00 (${temps[bestTempIdx]}°C)
• Cleanest air: ${hours[bestAirIdx]}:00 (${pm25s[bestAirIdx]} μg/m³)

❌ **Worst Times:**
• Poorest air quality: ${hours[worstAirIdx]}:00 (${pm25s[worstAirIdx]} μg/m³)

💡 **Best overall time for outdoor activities:** ${hours[bestAirIdx]}:00`;
        }
        return "Select a location to get best/worst times analysis! ⏰";
    }

    getAirQualityDescription(pm25) {
        if (pm25 <= 12) return "Good 😊";
        if (pm25 <= 35) return "Moderate 😐";
        if (pm25 <= 55) return "Unhealthy for Sensitive 😷";
        if (pm25 <= 150) return "Unhealthy 🚨";
        return "Hazardous ☣️";
    }

    getAirQualityAdvice(pm25) {
        if (pm25 <= 12) return "Perfect for all outdoor activities!";
        if (pm25 <= 35) return "Generally safe, sensitive people should monitor symptoms.";
        if (pm25 <= 55) return "Sensitive groups should reduce prolonged outdoor exertion.";
        if (pm25 <= 150) return "Everyone should limit outdoor activities and consider wearing masks.";
        return "Avoid outdoor activities. Stay indoors with air purification if possible.";
    }

    getTemperatureAdvice(current, max, min) {
        if (max > 30) return "🔥 Hot day ahead! Stay hydrated and seek shade during peak hours.";
        if (min < 5) return "❄️ Cold conditions. Dress warmly and protect exposed skin.";
        if (max - min > 15) return "🌡️ Large temperature swing today. Dress in layers!";
        return "🌤️ Pleasant temperatures expected. Great day for outdoor activities!";
    }

    getWindAdvice(current, max) {
        if (max > 25) return "💨 Windy conditions expected. Secure loose items outdoors.";
        if (current < 5) return "🍃 Light winds. Great for outdoor sports and activities.";
        return "💨 Moderate winds. Generally pleasant conditions.";
    }

    getWeatherAdvice(current) {
        const temp = current.temperature;
        const pm25 = current.pm25;
        
        if (temp > 30 && pm25 > 35) return "🚨 Hot and polluted - stay indoors during midday.";
        if (temp < 10 && pm25 > 35) return "❄️😷 Cold and polluted - limit outdoor time, dress warmly.";
        if (pm25 <= 12 && temp >= 18 && temp <= 28) return "✨ Perfect conditions for outdoor activities!";
        return "Check individual factors for detailed recommendations.";
    }

    getOverallHealthAdvice(temp, pm25) {
        if (pm25 <= 12 && temp >= 15 && temp <= 30) return "Perfect for all outdoor activities! 🌟";
        if (pm25 > 55) return "Stay indoors due to poor air quality 🏠";
        if (temp > 35) return "Avoid midday activities due to heat 🌡️";
        if (temp < 0) return "Dress warmly and limit exposure ❄️";
        return "Moderate conditions - listen to your body 👂";
    }
    
    updateChatbotContext() {
        // This method is called whenever new weather data is loaded
        // The chatbot can now access this.weatherData and this.currentLocation
        console.log('Chatbot context updated with new weather data');
        
        // Optionally add a system message to chat
        if (this.weatherData && this.currentLocation) {
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages && chatMessages.children.length === 0) {
                // Only add welcome message if chat is empty
                this.addMessageToChat(
                    `👋 Hi! I can help you understand the climate data for ${this.currentLocation.name}. Ask me about current conditions, temperature trends, air quality, or weather patterns!`, 
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