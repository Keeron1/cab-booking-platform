async function loadLocations() {
    try {
        const res = await fetch(`${API}/locations`, { headers: authHeaders() })
        const data = await res.json()
        const el = document.getElementById('locationsList')
        if (!data.locations.length) return el.innerHTML = '<p class="text-muted">No saved locations.</p>'
        el.innerHTML = data.locations.map(l => `
            <div class="card booking-card shadow-sm">
                <div class="card-body py-2 d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${l.label}</strong>
                        <div class="small text-muted">${l.address || ''}${l.lat ? ` (${l.lat}, ${l.lng})` : ''}</div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-info" onclick="getWeather('${l._id}')">Weather</button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteLocation('${l._id}')">Remove</button>
                    </div>
                </div>
            </div>
        `).join('')
    } catch {
        document.getElementById('locationsList').innerHTML = '<p class="text-danger">Failed to load.</p>'
    }
}

async function addLocation() {
    const label = document.getElementById('locLabel').value
    const address = document.getElementById('locAddress').value
    const lat = document.getElementById('locLat').value
    const lng = document.getElementById('locLng').value

    if (!label || !address) return showAlert('locAlert', 'Label and address are required')

    try {
        const body = { label, address }
        if (lat) body.lat = parseFloat(lat)
        if (lng) body.lng = parseFloat(lng)

        const res = await fetch(`${API}/locations`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body)
        })
        const data = await res.json()
        if (!res.ok) return showAlert('locAlert', data.error)

        document.getElementById('locAlert').innerHTML = ''
        document.getElementById('locLabel').value = ''
        document.getElementById('locAddress').value = ''
        document.getElementById('locLat').value = ''
        document.getElementById('locLng').value = ''
        loadLocations()
    } catch {
        showAlert('locAlert', 'Failed to add location')
    }
}

async function deleteLocation(id) {
    if (!confirm('Remove this location?')) return
    await fetch(`${API}/locations/${id}`, { method: 'DELETE', headers: authHeaders() })
    loadLocations()
}

async function getWeather(id) {
    const modal = new bootstrap.Modal(document.getElementById('weatherModal'))
    document.getElementById('weatherBody').innerHTML = 'Loading...'
    modal.show()
    try {
        const res = await fetch(`${API}/locations/${id}/weather`, { headers: authHeaders() })
        const data = await res.json()
        if (!res.ok) return document.getElementById('weatherBody').innerHTML = `<p class="text-danger">${data.error}</p>`
        const f = data.forecast
        document.getElementById('weatherBody').innerHTML = `
            <p><strong>${f.location.name}, ${f.location.country}</strong><br>
            <small class="text-muted">${f.location.localtime}</small></p>
            <hr>
            <p>🌡️ Current: <strong>${f.current.tempC}°C</strong> — ${f.current.condition}</p>
            <p>💨 Wind: ${f.current.windKph} km/h &nbsp; 💧 Humidity: ${f.current.humidity}%</p>
            <hr>
            <p><strong>Today's Forecast</strong></p>
            <p>High: ${f.forecastDay.maxTempC}°C / Low: ${f.forecastDay.minTempC}°C</p>
            <p>🌧️ Chance of rain: ${f.forecastDay.chanceOfRain}%</p>
            <p>${f.forecastDay.condition}</p>
        `
    } catch {
        document.getElementById('weatherBody').innerHTML = '<p class="text-danger">Failed to load weather.</p>'
    }
}
