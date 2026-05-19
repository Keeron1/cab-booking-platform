require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { createProxyMiddleware } = require("http-proxy-middleware")

const PORT = process.env.PORT || 3000

const app = express()
app.use(cors())

// Block any attempt to access service internal routes
app.use((req, res, next) => {
    if (req.path.startsWith("/internal") || req.path.includes("/internal/")) {
        return res.status(404).json({ error: "Not found" })
    }
    next()
})

// Routing table: path prefix > target service
const routes = [
    { prefix: "/auth",         target: process.env.CUSTOMER_SERVICE_URL },
    { prefix: "/account",      target: process.env.CUSTOMER_SERVICE_URL },
    { prefix: "/notifications", target: process.env.CUSTOMER_SERVICE_URL },

    { prefix: "/bookings",     target: process.env.BOOKING_SERVICE_URL },

    { prefix: "/payments",     target: process.env.PAYMENT_SERVICE_URL },
    { prefix: "/pay",          target: process.env.PAYMENT_SERVICE_URL },
    { prefix: "/quote",        target: process.env.PAYMENT_SERVICE_URL },

    { prefix: "/locations",    target: process.env.LOCATION_SERVICE_URL },
]

for (const { prefix, target } of routes) {
    app.use(
        prefix,
        createProxyMiddleware({
            target,
            changeOrigin: true,
            pathRewrite: (path) => `${prefix}${path}`,
        })
    )
}

app.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`))
