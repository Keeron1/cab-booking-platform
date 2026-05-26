async function loadNotifications() {
    try {
        const res = await fetch(`${API}/notifications`, { headers: authHeaders() })
        const data = await res.json()
        const el = document.getElementById('notifications')
        const badge = document.getElementById('notifBadge')

        const unread = data.notifications.filter(n => !n.read).length
        if (unread > 0) { badge.textContent = unread; badge.classList.remove('d-none') }
        else badge.classList.add('d-none')

        if (!data.notifications.length) return el.innerHTML = '<p class="text-muted">No notifications.</p>'
        el.innerHTML = data.notifications.map(n => `
            <div class="card booking-card shadow-sm ${n.read ? '' : 'border-primary'}">
                <div class="card-body py-2">
                    <div class="d-flex justify-content-between">
                        <strong>${n.title}</strong>
                        <small class="text-muted">${new Date(n.createdAt).toLocaleString()}</small>
                    </div>
                    <p class="mb-0 small">${n.message}</p>
                    ${!n.read ? `<button class="btn btn-link btn-sm p-0 mt-1" onclick="markRead('${n._id}')">Mark as read</button>` : ''}
                </div>
            </div>
        `).join('')
    } catch {
        document.getElementById('notifications').innerHTML = '<p class="text-danger">Failed to load.</p>'
    }
}

async function markRead(id) {
    await fetch(`${API}/notifications/${id}/read`, { method: 'PATCH', headers: authHeaders() })
    loadNotifications()
}

async function markAllRead() {
    await fetch(`${API}/notifications/read-all`, { method: 'PATCH', headers: authHeaders() })
    loadNotifications()
}
