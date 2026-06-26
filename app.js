let currentLat = null;
let currentLon = null;
let dailyData = null;
let searchTimeout = null;
let searchResults = [];

function cToF(c) {
    return Math.round((c * 9 / 5) + 32);
}

function kmhToMph(kmh) {
    return Math.round(kmh * 0.621371);
}

function getWindDirection(degrees) {
    const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return directions[Math.round(degrees / 22.5) % 16];
}

function getWindArrow(degrees) {
    return `<span style="transform: rotate(${degrees}deg); display: inline-block; font-size: 1.1em;">↓</span>`;
}

function getWeatherEmoji(code) {
    const map = {
        0: "☀️",
        1: "🌤️",
        2: "⛅",
        3: "☁️",
        45: "🌫️",
        61: "🌧️",
        63: "🌧️",
        65: "🌧️",
        71: "❄️",
        73: "❄️",
        75: "❄️",
        80: "🌦️",
        95: "⛈️"
    };
    return map[code] || "🌥️";
}

async function searchLocation(selectedResult = null) {
    const input = document.getElementById('searchInput').value.trim();
    if (!input && !selectedResult) return;

    hideAutocomplete();
    showLoading();

    try {
        let location;
        if (selectedResult) {
            location = selectedResult;
        } else {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=10&language=en&format=json`);
            const geoData = await geoRes.json();

            if (!geoData.results?.length) throw new Error("Location not found.");

            location = geoData.results.find((l) => l.country_code === "US") || geoData.results[0];
        }

        currentLat = location.latitude;
        currentLon = location.longitude;

        await fetchWeather(location);
    } catch (err) {
        showError(err.message || "Failed to search location.");
    }
}

async function fetchWeather(location) {
    try {
        const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?` +
            `latitude=${currentLat}&longitude=${currentLon}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation` +
            `&hourly=temperature_2m,weather_code,precipitation_probability,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,` +
            `wind_speed_10m_max,wind_direction_10m_dominant,relative_humidity_2m_max,relative_humidity_2m_min,relative_humidity_2m_mean` +
            `&timezone=auto`
        );

        if (!res.ok) throw new Error("Weather API error");
        const data = await res.json();

        if (!data.current || !data.daily || !data.hourly) throw new Error("Invalid weather data received");

        dailyData = data.daily;

        renderCurrent(data, location);
        renderHourly(data.hourly);
        renderForecast(data.daily);
        saveLocation(location);

        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('loading').classList.add('hidden');
    } catch (err) {
        showError("Failed to fetch weather data.");
    }
}

function renderCurrent(data, location) {
    const c = data.current;
    const d = data.daily;
    document.getElementById('locationName').textContent = `${location.name}, ${location.admin1 || location.country || ''}`;
    document.getElementById('currentTime').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    document.getElementById('currentTemp').innerHTML = `${cToF(c.temperature_2m)}<span class="text-4xl">°F</span>`;
    document.getElementById('currentCondition').textContent = getConditionName(c.weather_code);
    document.getElementById('currentIcon').innerHTML = `<span class="text-8xl">${getWeatherEmoji(c.weather_code)}</span>`;
    document.getElementById('feelsLike').textContent = `Feels like ${cToF(c.apparent_temperature)}°F`;

    if (d && d.temperature_2m_max && d.temperature_2m_min) {
        document.getElementById('currentHighLow').textContent = `H: ${cToF(d.temperature_2m_max[0])}°  L: ${cToF(d.temperature_2m_min[0])}°`;
    }

    document.getElementById('humidity').textContent = `${c.relative_humidity_2m}%`;
    document.getElementById('precip').textContent = `${(c.precipitation * 0.03937).toFixed(2)} in`;

    const windMph = kmhToMph(c.wind_speed_10m);
    const gustMph = kmhToMph(c.wind_gusts_10m);
    const dir = getWindDirection(c.wind_direction_10m);
    document.getElementById('wind').innerHTML = `${windMph} mph ${dir} ${getWindArrow(c.wind_direction_10m)}`;
    document.getElementById('gusts').textContent = `${gustMph} mph`;
}

function renderHourly(hourly) {
    const container = document.getElementById('hourlyContainer');
    container.innerHTML = '';

    const currentHour = new Date().getHours();

    for (let i = 0; i < 24; i++) {
        const hourIndex = currentHour + i;
        if (hourIndex >= hourly.time.length) break;

        const time = new Date(hourly.time[hourIndex]);
        const hourStr = time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        const isNow = i === 0;

        const windMph = kmhToMph(hourly.wind_speed_10m[hourIndex]);
        const gustMph = kmhToMph(hourly.wind_gusts_10m[hourIndex]);
        const windDir = getWindDirection(hourly.wind_direction_10m[hourIndex]);
        const card = document.createElement('div');
        card.className = `flex-shrink-0 bg-gray-900/70 rounded-2xl p-4 text-center min-w-[80px] ${isNow ? 'bg-gray-800/90' : ''}`;
        card.innerHTML = `
            <div class="text-xs text-gray-400 mb-2">${isNow ? 'Now' : hourStr}</div>
            <div class="text-3xl my-2">${getWeatherEmoji(hourly.weather_code[hourIndex])}</div>
            <div class="font-semibold">${cToF(hourly.temperature_2m[hourIndex])}°</div>
            <div class="text-xs text-blue-300 mt-1">${hourly.precipitation_probability[hourIndex]}% rain</div>
            <div class="text-xs text-gray-400">${hourly.relative_humidity_2m[hourIndex]}% humidity</div>
            <div class="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">${getWindArrow(hourly.wind_direction_10m[hourIndex])} ${windMph} -  ${gustMph} mph</div>
        `;
        container.appendChild(card);
    }
}

function renderForecast(daily) {
    const container = document.getElementById('forecastContainer');
    container.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const date = new Date(daily.time[i] + 'T12:00:00');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

        const card = document.createElement('div');
        card.className = "forecast-card bg-gray-900/70 rounded-3xl p-6 text-center cursor-pointer hover:bg-gray-800/70";
        card.onclick = () => showDayDetail(i);
        const windMph = kmhToMph(daily.wind_speed_10m_max[i]);
        const windDir = getWindDirection(daily.wind_direction_10m_dominant[i]);
        card.innerHTML = `
            <div class="text-sm text-gray-400">${dayName}</div>
            <div class="text-5xl my-3">${getWeatherEmoji(daily.weather_code[i])}</div>
            <div class="font-semibold text-xl">${cToF(daily.temperature_2m_max[i])}°</div>
            <div class="text-gray-400 text-sm">${cToF(daily.temperature_2m_min[i])}°</div>
            <div class="mt-2 text-xs text-blue-300">${daily.precipitation_probability_max[i]}% rain</div>
            <div class="mt-1 text-xs text-gray-400 flex items-center justify-center gap-1">
                <i class="fa-solid fa-droplet text-[10px]"></i> ${daily.relative_humidity_2m_mean[i]}%
            </div>
            <div class="text-xs text-gray-400 flex items-center justify-center gap-1">
                <i class="fa-solid fa-wind text-[10px]"></i> ${windMph} mph
            </div>
        `;
        container.appendChild(card);
    }
}

function showDayDetail(index) {
    const d = dailyData;
    const date = new Date(d.time[index] + 'T12:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    document.getElementById('modalDay').textContent = dayName;

    const content = `
        <div class="grid grid-cols-2 gap-6 text-center">
            <div>
                <div class="text-6xl mb-2">${getWeatherEmoji(d.weather_code[index])}</div>
                <div class="text-3xl font-light">${cToF(d.temperature_2m_max[index])}° / ${cToF(d.temperature_2m_min[index])}°</div>
            </div>
            <div class="space-y-4 text-left text-sm">
                <div><span class="text-gray-400">Precipitation Chance:</span> <span class="font-medium">${d.precipitation_probability_max[index]}%</span></div>
                <div><span class="text-gray-400">Humidity:</span> 
                    <span class="font-medium">${d.relative_humidity_2m_max[index]}% / ${d.relative_humidity_2m_min[index]}%</span><br>
                    <span class="text-xs text-gray-500">(avg ${d.relative_humidity_2m_mean[index]}%)</span>
                </div>
                <div>
                    <span class="text-gray-400">Wind:</span> 
                    <span class="font-medium">${kmhToMph(d.wind_speed_10m_max[index])} mph ${getWindDirection(d.wind_direction_10m_dominant[index])}</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('modalContent').innerHTML = content;
    document.getElementById('detailModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

function getConditionName(code) {
    const map = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        61: "Light rain",
        63: "Rain",
        65: "Heavy rain",
        71: "Light snow",
        73: "Snow",
        75: "Heavy snow",
        95: "Thunderstorm"
    };
    return map[code] || "Cloudy";
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');
}

function showError(msg) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = msg;
}

function hideAutocomplete() {
    document.getElementById('autocompleteDropdown').classList.add('hidden');
    searchResults = [];
}

async function handleSearchInput(value) {
    clearTimeout(searchTimeout);

    if (value.length < 2) {
        hideAutocomplete();
        return;
    }

    searchTimeout = setTimeout(async () => {
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(value)}&count=10&language=en&format=json`);
            const geoData = await geoRes.json();

            if (geoData.results?.length) {
                searchResults = geoData.results;
                showAutocomplete(geoData.results);
            } else {
                hideAutocomplete();
            }
        } catch (err) {
            hideAutocomplete();
        }
    }, 300);
}

function showAutocomplete(results) {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.innerHTML = '';

    results.forEach((result) => {
        const item = document.createElement('div');
        const state = result.admin1 || result.country || '';
        const country = result.country_code || '';
        const displayText = `${result.name}${state ? ', ' + state : ''}${country && country !== 'US' ? ', ' + country : ''}`;

        item.className = 'px-6 py-3 hover:bg-gray-700 cursor-pointer border-b border-gray-700 last:border-0 transition';
        item.textContent = displayText;
        item.onclick = () => {
            document.getElementById('searchInput').value = displayText;
            searchLocation(result);
        };
        dropdown.appendChild(item);
    });

    dropdown.classList.remove('hidden');
}

document.addEventListener('click', (e) => {
    const searchContainer = document.querySelector('.bg-gray-900.rounded-3xl');
    if (searchContainer && !searchContainer.contains(e.target)) {
        hideAutocomplete();
    }
});

(function setupDraggableScroll() {
    const container = document.getElementById('hourlyContainer');
    if (!container) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    container.addEventListener('mousedown', (e) => {
        isDown = true;
        container.classList.add('active');
        startX = e.pageX - container.offsetLeft;
        scrollLeft = container.scrollLeft;
    });
    container.addEventListener('mouseleave', () => {
        isDown = false;
        container.classList.remove('active');
    });
    container.addEventListener('mouseup', () => {
        isDown = false;
        container.classList.remove('active');
    });
    container.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - container.offsetLeft;
        const walk = (x - startX) * 2;
        container.scrollLeft = scrollLeft - walk;
    });
})();

async function getUserLocation() {
    if (!navigator.geolocation) {
        showError("Geolocation not supported by your browser.");
        return;
    }
    showLoading();
    navigator.geolocation.getCurrentPosition(async (pos) => {
        currentLat = pos.coords.latitude;
        currentLon = pos.coords.longitude;

        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLat}&lon=${currentLon}`);
            const geo = await geoRes.json();
            const loc = {
                name: geo.address.city || geo.address.town || geo.address.village || geo.address.county || "Your Location",
                admin1: geo.address.state || "",
                country: geo.address.country_code || "US",
                latitude: currentLat,
                longitude: currentLon
            };
            await fetchWeather(loc);
        } catch (err) {
            await fetchWeather({ name: "Your Location", latitude: currentLat, longitude: currentLon });
        }
    }, (err) => {
        let msg = "Could not get location.";
        if (err.code === 1) msg = "Location access denied. Please enable location services.";
        else if (err.code === 2) msg = "Location unavailable. Please try again.";
        else if (err.code === 3) msg = "Location request timed out.";
        showError(msg);
    });
}

function saveLocation(location) {
    localStorage.setItem('savedLocation', JSON.stringify(location));
}

function loadSavedLocation() {
    const saved = localStorage.getItem('savedLocation');
    if (saved) {
        try {
            const location = JSON.parse(saved);
            if (location.latitude && location.longitude) {
                currentLat = location.latitude;
                currentLon = location.longitude;
                fetchWeather(location);
                return true;
            }
        } catch (e) {
            localStorage.removeItem('savedLocation');
        }
    }
    return false;
}

function toggleMusic() {
    const player = document.getElementById('jazzPlayer');
    const icon = document.getElementById('musicIcon');
    const btn = document.getElementById('musicBtn');
    const waves = document.getElementById('musicWaves');

    if (player.paused) {
        player.play();
        icon.className = 'fa-solid fa-pause text-blue-300';
        waves.classList.remove('hidden');
        btn.classList.add('bg-blue-600');
        btn.classList.remove('bg-gray-800');
    } else {
        player.pause();
        icon.className = 'fa-solid fa-music text-blue-300';
        waves.classList.add('hidden');
        btn.classList.remove('bg-blue-600');
        btn.classList.add('bg-gray-800');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadSavedLocation();
});
