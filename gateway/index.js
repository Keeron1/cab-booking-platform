require("dotenv").config()
const express = require("express")
const cors = require("cors")
const { createProxyMiddleware } = require("http-proxy-middleware")
const rateLimit = require("express-rate-limit")

const PORT = process.env.PORT || 3000

const app = express()
app.set("trust proxy", 1)
app.use(cors())

// Rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 200, // total requests
})
app.use(limiter);

// Block any attempt to access service internal routes
app.use((req, res, next) => {
    if (req.path.includes("/internal/")) 
        return res.status(404).json({ error: "Not found" })
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
    // For each request, forward to
    app.use(prefix, createProxyMiddleware({
        target, // base url
        changeOrigin: true, // Update host header
        pathRewrite: (path) => `${prefix}${path}`,// Adds the prefix to the path
        on: {
            error: (err, req, res) => {
                console.error(`[Gateway] Proxy error to ${target}:`, err.message);
                res.status(502).json({ error: "Service temporarily unavailable" });
            },
        },
    }))
}

app.listen(PORT, () => console.log(`[Gateway] Running on port ${PORT}`))
