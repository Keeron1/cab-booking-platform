const API = 'http://localhost:3000'

function authHeaders() {
    const token = localStorage.getItem('token')
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    }
}

function showAlert(id, msg, type = 'danger') {
    document.getElementById(id).innerHTML = `<div class="alert alert-${type} py-2">${msg}</div>`
}

function statusBadge(status) {
    const colours = {
        PAYING: 'secondary', CONFIRMED: 'primary', DRIVER_ASSIGNED: 'info',
        IN_PROGRESS: 'warning', COMPLETED: 'success', CANCELLED: 'danger'
    }
    return `<span class="badge bg-${colours[status] || 'secondary'}">${status}</span>`
}

function locationLabel(loc) {
    if (!loc) return '—'
    return loc.address || `${loc.lat}, ${loc.lng}`
}

function buildLocation(address, lat, lng) {
    const loc = {}
    if (address) loc.address = address
    if (lat !== '' && lat != null) loc.lat = parseFloat(lat)
    if (lng !== '' && lng != null) loc.lng = parseFloat(lng)
    return loc
}
