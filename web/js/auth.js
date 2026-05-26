document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
        const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value,
            })
        })
        const data = await res.json()
        if (!res.ok) return showAlert('loginAlert', data.error)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        window.location.href = 'dashboard.html'
    } catch {
        showAlert('loginAlert', 'Could not connect to server')
    }
})

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
        const res = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                firstName: document.getElementById('regFirstName').value,
                lastName: document.getElementById('regLastName').value,
                email: document.getElementById('regEmail').value,
                password: document.getElementById('regPassword').value,
            })
        })
        const data = await res.json()
        if (!res.ok) return showAlert('registerAlert', data.error)
        localStorage.setItem('token', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        window.location.href = 'dashboard.html'
    } catch {
        showAlert('registerAlert', 'Could not connect to server')
    }
})
