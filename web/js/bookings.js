let lastQuote = null

// Load saved locations into the start location dropdown
async function loadLocationPicker() {
    try {
        const res = await fetch(`${API}/locations`, { headers: authHeaders() })
        const data = await res.json()
        const select = document.getElementById('startLocationPicker')
        select.innerHTML = '<option value="">-- Select a saved location --</option>'
        data.locations.forEach(l => {
            const opt = document.createElement('option')
            opt.value = JSON.stringify({ address: l.address, lat: l.lat, lng: l.lng })
            opt.textContent = `${l.label}${l.address ? ' — ' + l.address : ''}`
            select.appendChild(opt)
        })
    } catch {
        // Silently fail — user can still type manually
    }
}

function onStartLocationPicked() {
    const val = document.getElementById('startLocationPicker').value
    if (!val) return
    const loc = JSON.parse(val)
    document.getElementById('startAddress').value = loc.address || ''
    document.getElementById('startLat').value = loc.lat || ''
    document.getElementById('startLng').value = loc.lng || ''
}

async function getQuote() {
    const startLocation = buildLocation(
        document.getElementById('startAddress').value,
        document.getElementById('startLat').value,
        document.getElementById('startLng').value
    )
    const endLocation = buildLocation(
        document.getElementById('endAddress').value,
        document.getElementById('endLat').value,
        document.getElementById('endLng').value
    )

    if (!Object.keys(startLocation).length || !Object.keys(endLocation).length)
        return showAlert('bookAlert', 'Please provide at least an address or coordinates for both locations.')

    try {
        const res = await fetch(`${API}/quote`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                cabType: document.getElementById('cabType').value,
                dateTime: new Date(document.getElementById('dateTime').value).toISOString(),
                passengers: parseInt(document.getElementById('passengers').value),
                startLocation,
                endLocation,
            })
        })
        const data = await res.json()
        if (!res.ok) return showAlert('bookAlert', data.error)

        lastQuote = data.quote
        document.getElementById('bookAlert').innerHTML = ''
        document.getElementById('quoteCard').classList.remove('d-none')

        const q = data.quote
        document.getElementById('quoteTable').innerHTML = `
            <tr><td>Base Fare</td><td>€${q.baseFare.toFixed(2)}</td></tr>
            <tr><td>Cab Multiplier</td><td>x${q.cabMultiplier}</td></tr>
            <tr><td>Daytime Multiplier</td><td>x${q.daytimeMultiplier}</td></tr>
            <tr><td>Passengers Multiplier</td><td>x${q.passengersMultiplier}</td></tr>
            <tr><td>Discount</td><td>x${q.discountMultiplier}</td></tr>
        `
        document.getElementById('quoteTotal').textContent = `Total: €${q.totalPrice.toFixed(2)}`
        document.getElementById('discountNote').textContent = q.discountAvailable ? '✅ 15% discount applied!' : ''
        document.getElementById('payBtn').disabled = false
    } catch {
        showAlert('bookAlert', 'Could not get quote')
    }
}

async function pay() {
    const startLocation = buildLocation(
        document.getElementById('startAddress').value,
        document.getElementById('startLat').value,
        document.getElementById('startLng').value
    )
    const endLocation = buildLocation(
        document.getElementById('endAddress').value,
        document.getElementById('endLat').value,
        document.getElementById('endLng').value
    )

    try {
        const res = await fetch(`${API}/pay`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({
                cabType: document.getElementById('cabType').value,
                dateTime: new Date(document.getElementById('dateTime').value).toISOString(),
                passengers: parseInt(document.getElementById('passengers').value),
                startLocation,
                endLocation,
            })
        })
        const data = await res.json()
        if (!res.ok) return showAlert('bookAlert', data.error)

        showAlert('bookAlert', `✅ Booking confirmed! Total: €${data.payment.totalPrice.toFixed(2)}`, 'success')
        document.getElementById('quoteCard').classList.add('d-none')
        document.getElementById('payBtn').disabled = true
        lastQuote = null
    } catch {
        showAlert('bookAlert', 'Payment failed')
    }
}

async function loadCurrentBookings() {
    try {
        const res = await fetch(`${API}/bookings/current`, { headers: authHeaders(), cache: 'no-store' })
        const data = await res.json()
        const el = document.getElementById('currentBookings')
        if (!data.bookings.length) return el.innerHTML = '<p class="text-muted">No current bookings.</p>'
        el.innerHTML = data.bookings.map(b => `
            <div class="card booking-card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${locationLabel(b.startLocation)} → ${locationLabel(b.endLocation)}</strong><br>
                            <small class="text-muted">${new Date(b.bookingTime).toLocaleString()} · ${b.cabType} · ${b.passengers} passenger(s)</small>
                            ${b.totalPrice ? `<div class="mt-1">€${b.totalPrice.toFixed(2)}</div>` : ''}
                        </div>
                        <div class="d-flex flex-column align-items-end gap-2">
                            ${statusBadge(b.status)}
                            ${['IN_PROGRESS', 'DRIVER_ASSIGNED', 'CONFIRMED'].includes(b.status)
                                ? `<button class="btn btn-sm btn-success" onclick="completeRide('${b._id}')">Complete Ride</button>`
                                : ''}
                        </div>
                    </div>
                </div>
            </div>
        `).join('')
    } catch {
        document.getElementById('currentBookings').innerHTML = '<p class="text-danger">Failed to load.</p>'
    }
}

async function completeRide(id) {
    if (!confirm('Mark this ride as completed?')) return
    try {
        const res = await fetch(`${API}/bookings/${id}/complete`, {
            method: 'POST',
            headers: authHeaders(),
        })
        const data = await res.json()
        if (!res.ok) return alert(data.error)
        loadCurrentBookings()
    } catch {
        alert('Failed to complete ride')
    }
}

async function loadPastBookings() {
    try {
        const res = await fetch(`${API}/bookings/past`, { headers: authHeaders(), cache: 'no-store' })
        const data = await res.json()
        const el = document.getElementById('pastBookings')
        if (!data.bookings.length) return el.innerHTML = '<p class="text-muted">No past bookings.</p>'
        el.innerHTML = data.bookings.map(b => `
            <div class="card booking-card shadow-sm">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <strong>${locationLabel(b.startLocation)} → ${locationLabel(b.endLocation)}</strong><br>
                            <small class="text-muted">${new Date(b.bookingTime).toLocaleString()} · ${b.cabType} · ${b.passengers} passenger(s)</small>
                            ${b.totalPrice ? `<div class="mt-1">€${b.totalPrice.toFixed(2)}</div>` : ''}
                        </div>
                        ${statusBadge(b.status)}
                    </div>
                </div>
            </div>
        `).join('')
    } catch {
        document.getElementById('pastBookings').innerHTML = '<p class="text-danger">Failed to load.</p>'
    }
}
