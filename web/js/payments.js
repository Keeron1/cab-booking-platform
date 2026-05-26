async function loadPayments() {
    try {
        const res = await fetch(`${API}/payments`, { headers: authHeaders(), cache: 'no-store' })
        const data = await res.json()
        const el = document.getElementById('paymentsList')
        if (!data.payments.length) return el.innerHTML = '<p class="text-muted">No payments yet.</p>'
        el.innerHTML = `
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Date</th><th>Base Fare</th><th>Cab</th><th>Daytime</th>
                        <th>Passengers</th><th>Discount</th><th>Total</th>
                    </tr>
                </thead>
                <tbody>
                ${data.payments.map(p => `
                    <tr>
                        <td>${new Date(p.createdAt).toLocaleDateString()}</td>
                        <td>€${p.baseFare.toFixed(2)}</td>
                        <td>x${p.cabMultiplier}</td>
                        <td>x${p.daytimeMultiplier}</td>
                        <td>x${p.passengersMultiplier}</td>
                        <td>${p.discountApplied ? '✅ 15% off' : '—'}</td>
                        <td><strong>€${p.totalPrice.toFixed(2)}</strong></td>
                    </tr>
                `).join('')}
                </tbody>
            </table>
        `
    } catch {
        document.getElementById('paymentsList').innerHTML = '<p class="text-danger">Failed to load.</p>'
    }
}
