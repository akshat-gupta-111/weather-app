class ClimateExplorer {
    constructor() {
        this.map = null;
        this.currentLocation = null;
        this.currentPeriod = 'today';
        this.charts = {};
        
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
            
            this.selectLocationFromCoords(latitude, longitude, e.clientX, e.clientY);
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
    
    setupMap() {
        setTimeout(() => {
            this.map = L.map('map').setView([20, 0], 2);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            this.map.on('click', (e) => {
                this.selectLocationFromCoords(e.latlng.lat, e.latlng.lng);
            });
        }, 100);
    }
    
    async selectLocationFromCoords(lat, lon, cursorX = null, cursorY = null) {
        try {
            // Show loading if needed
            if (cursorX && cursorY) {
                document.getElementById('tooltip').textContent = 'Loading...';
                document.getElementById('tooltip').style.left = `${cursorX + 15}px`;
                document.getElementById('tooltip').style.top = `${cursorY}px`;
                document.getElementById('tooltip').style.opacity = '1';
            }
            
            const response = await fetch(`/api/location-from-coords?lat=${lat}&lon=${lon}`);
            const location = await response.json();
            
            this.selectLocation(lat, lon, location.display_name);
            
            if (cursorX && cursorY) {
                setTimeout(() => {
                    document.getElementById('tooltip').style.opacity = '0';
                }, 2000);
            }
        } catch (error) {
            console.error('Error getting location:', error);
        }
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
            },
            '1year': {
                temp: 'Temperature (Last 12 Months)',
                precip: 'Rainfall (Last 12 Months)',
                air: 'Air Quality (Last 12 Months)',
                heatmap: 'Air Quality Heatmap (12 Months)'
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
            
            this.displayClimateData(data);
        } catch (error) {
            console.error('Error loading climate data:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    displayClimateData(data) {
        // Update current conditions (if today)
        if (data.period === 'today' && data.current) {
            document.getElementById('currentTemp').textContent = data.current.temperature;
            document.getElementById('currentHumidity').textContent = data.current.humidity;
            document.getElementById('currentPM25').textContent = data.current.pm25;
            document.getElementById('currentWind').textContent = data.current.windspeed;
        }
        
        // Create charts based on period
        this.createCharts(data);
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
            case '1year':
                this.createYearlyCharts(data);
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
        this.createAirQualityHeatmap(hourly.hours.map(h => `${h}:00`), hourly.pm25, 'heatmapChart');
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
        this.createAirQualityHeatmap(daily.day_names, daily.pm25, 'heatmapChart');
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
        this.createAirQualityHeatmap(weekly.weeks, weekly.pm25, 'heatmapChart');
    }
    
    createYearlyCharts(data) {
        const monthly = data.monthly;
        
        // Temperature Chart
        const tempCtx = document.getElementById('temperatureChart').getContext('2d');
        this.charts.temperature = new Chart(tempCtx, {
            type: 'line',
            data: {
                labels: monthly.months,
                datasets: [
                    {
                        label: 'Max Temp (°C)',
                        data: monthly.temp_max,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    },
                    {
                        label: 'Min Temp (°C)',
                        data: monthly.temp_min,
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
                labels: monthly.months,
                datasets: [{
                    label: 'Rainfall (mm)',
                    data: monthly.precipitation,
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
                labels: monthly.months,
                datasets: [
                    {
                        label: 'PM2.5',
                        data: monthly.pm25,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)'
                    },
                    {
                        label: 'PM10',
                        data: monthly.pm10,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    }
                ]
            },
            options: this.getChartOptions()
        });
        
        // Heatmap
        this.createAirQualityHeatmap(monthly.months, monthly.pm25, 'heatmapChart');
    }
    
    createAirQualityHeatmap(labels, pm25Data, canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        // Create color-coded background colors based on AQI levels
        const getAQIColor = (pm25) => {
            if (pm25 <= 12) return 'rgba(34, 197, 94, 0.8)';  // Good - Green
            if (pm25 <= 35) return 'rgba(245, 158, 11, 0.8)'; // Moderate - Yellow
            if (pm25 <= 55) return 'rgba(249, 115, 22, 0.8)'; // Unhealthy for Sensitive - Orange
            if (pm25 <= 150) return 'rgba(239, 68, 68, 0.8)'; // Unhealthy - Red
            return 'rgba(147, 51, 234, 0.8)'; // Hazardous - Purple
        };
        
        const backgroundColors = pm25Data.map(pm25 => getAQIColor(pm25));
        const borderColors = pm25Data.map(pm25 => getAQIColor(pm25).replace('0.8', '1'));
        
        this.charts.heatmap = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'PM2.5 Air Quality Index',
                    data: pm25Data,
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
        
        // Add custom legend below heatmap
        this.addHeatmapLegend(canvasId);
    }
    
    addHeatmapLegend(canvasId) {
        const legendContainer = document.querySelector(`#${canvasId}`).parentNode;
        
        // Remove existing legend
        const existingLegend = legendContainer.querySelector('.air-quality-legend');
        if (existingLegend) {
            existingLegend.remove();
        }
        
        // Create new legend
        const legend = document.createElement('div');
        legend.className = 'air-quality-legend';
        legend.innerHTML = `
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
                <span>Unhealthy (36-55)</span>
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
        
        legendContainer.appendChild(legend);
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
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ClimateExplorer();
});