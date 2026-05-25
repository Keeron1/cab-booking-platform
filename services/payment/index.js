require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const axios = require("axios")
const EventEmitter = require("events")

const { Payment, DiscountNotification } = require("./models/index");
const { authenticate } = require('./middleware')

const PORT = process.env.PORT || 3003
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL
const FARE_SERVICE_URL = process.env.FARE_SERVICE_URL

const app = express()
app.use(cors())
app.use(express.json())

const paymentEvents = new EventEmitter()

// When a discount is unlocked, notify the user about it
paymentEvents.on("discount:unlocked", async ({ userId, discount }) => {
    try {
        await axios.post(`${CUSTOMER_SERVICE_URL}/internal/notifications`, {
            userId,
            type: "DISCOUNT",
            title: "You've unlocked a discount!",
            message: "Thanks for booking with us. Your next ride will be 15% off.",
            meta: {
                discountMultiplier: 0.85,
                unlockedAt: discount.sentAt
            },
        })
        console.log(`[Payment] Discount notification sent to user ${userId}`)
    } catch (err) {
        console.error(`[Payment] Failed to send discount notifcation to ${userId}: ${err.message}`)
    }
})

// Connect to db
mongoose
    .connect(process.env.MONGODB_CONN)
    .then(() => console.log("[Payment] Connected to MongoDB"))
    .catch(err => { console.error("[Payment] DB error:", err); process.exit(1) })

function getCabMultiplier(cabType) {
    if (cabType === "Economic") return 1
    if (cabType === "Premium") return 1.2
    if (cabType === "Executive") return 1.4
    return null
}

function getDaytimeMultiplier(dateTime) {
    const hour = new Date(dateTime).getHours()
    // Between 12:00 AM and 8:00 AM: 1.2  Else 1
    if (hour >= 0 && hour < 8) return 1.2
    return 1
}

function getPassengersMultiplier(passengers) {
    if (passengers >= 1 && passengers <= 4) return 1
    if (passengers >= 5 && passengers <= 8) return 2
    return null
}

async function getCabFare({ dateTime, startLat, startLng, endLat, endLng } = {}) {
    const FALLBACK = 10

    if (startLat == null || startLng == null || endLat == null || endLng == null) return FALLBACK

    try {
        const { data } = await axios.get(`${FARE_SERVICE_URL}internal/fare`, {
            params: { startLat, startLng, endLat, endLng },
            timeout: 5000,
        })

        const hour = new Date(dateTime).getHours()
        const isNight = hour >= 0 && hour < 8

        // Try to get the amount for the valid time but if not available check the other time before using fallback
        const preferred = isNight ? data.nightFareCents : data.dayFareCents
        const fallback = isNight ? data.dayFareCents : data.nightFareCents

        const cents = preferred ?? fallback
        if (cents == null) return FALLBACK

        return cents / 100 // Convert from cents to proper format
    } catch (err) {
        console.error("[Payment] Fare service call failed:", err.message)
        return FALLBACK
    }
}

async function computeMultipliers({ cabType, dateTime, passengers, startLat, startLng, endLat, endLng }) {
    const cabMultiplier = getCabMultiplier(cabType)
    if (cabMultiplier === null) return { error: "Invalid cab type" }

    const passengersMultiplier = getPassengersMultiplier(passengers)
    if (passengersMultiplier === null) return { error: "Maximum 8 passengers allowed" }

    const daytimeMultiplier = getDaytimeMultiplier(dateTime)
    const baseFare = await getCabFare({ dateTime, startLat, startLng, endLat, endLng })

    return { baseFare, cabMultiplier, daytimeMultiplier, passengersMultiplier }
}

function calculateTotal({ baseFare, cabMultiplier, daytimeMultiplier, passengersMultiplier, discountMultiplier }) {
    return baseFare * cabMultiplier * daytimeMultiplier * passengersMultiplier * discountMultiplier
}


// Routes

// Get a booking price quote
app.post("/quote", authenticate, async (req, res) => {
    try {
        const { 
            cabType, 
            dateTime, 
            passengers, 
            startLocation, 
            endLocation 
        } = req.body

        if (!cabType || !dateTime || !passengers || !startLocation || !endLocation)
            return res.status(400).json({ error: "cabType, dateTime, passengers, startLocation and endLocation are required" })

        const multipliers = await computeMultipliers({ cabType, dateTime, passengers, startLocation, endLocation })
        if (multipliers.error) return res.status(400).json({ error: multipliers.error })

        const discountAvailable = !!(await DiscountNotification.findOne({ userId: req.user.id, usedAt: null }))
        
        const discountMultiplier = discountAvailable ? 0.85 : 1

        const totalPrice = calculateTotal({ ...multipliers, discountMultiplier })

        res.json({ quote: { ...multipliers, discountMultiplier, discountAvailable, totalPrice } })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Pay for a booking
app.post("/pay", authenticate, async (req, res) => {
    try {
        const { 
            cabType, 
            dateTime, 
            passengers, 
            startLocation, 
            endLocation 
        } = req.body

        if (!cabType || !dateTime || !passengers || !startLocation || !endLocation)
            return res.status(400).json({ error: "cabType, dateTime, passengers, startLocation and endLocation are required" })

        const multipliers = await computeMultipliers({ cabType, dateTime, passengers, startLocation, endLocation })
        if (multipliers.error) return res.status(400).json({ error: multipliers.error })

        // Request to create the booking so we can store its id in the payment record
        let booking
        try {
            const { data } = await axios.post(
                `${BOOKING_SERVICE_URL}internal/booking`,
                { startLocation, endLocation, dateTime, passengers, cabType },
                { headers: { Authorization: req.headers["authorization"] } }
            )
            booking = data.booking
        } catch (err) {
            console.error("[Payment] Booking creation failed:", err.message)
            return res.status(502).json({ error: "Could not create booking" })
        }

        if (!booking || !booking._id) {
            console.error("[Payment] Booking service returned an invalid response")
            return res.status(502).json({ error: "Could not create booking" })
        }

        // Claim discount if available
        const discountRecord = await DiscountNotification.findOneAndUpdate(
            { userId: req.user.id, usedAt: null },
            { $set: { usedAt: new Date() } },
            { new: false }
        )
        const discountMultiplier = discountRecord ? 0.85 : 1 // 15% off
        const discountApplied = !!discountRecord

        const totalPrice = calculateTotal({ ...multipliers, discountMultiplier })

        const payment = await Payment.create({
            userId: req.user.id,
            bookingId: booking._id,
            baseFare: multipliers.baseFare,
            cabMultiplier: multipliers.cabMultiplier,
            daytimeMultiplier: multipliers.daytimeMultiplier,
            discountMultiplier: discountMultiplier,
            totalPrice,
            discountApplied,
        })

        // Payment successfull so change booking status to CONFIRMED
        try {
            const { data } = await axios.post(
                `${BOOKING_SERVICE_URL}internal/bookings/${booking._id}/confirm`,
                {},
                { headers: { Authorization: req.headers["authorization"] } }
            )
            booking = data.booking
        } catch (err) {
            console.error("[Payment] Booking confirmation failed:", err.message)
        }

        res.status(201).json({ message: "Payment completed", payment, booking })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Get all the user's payments
app.get("/payments", authenticate, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 })
        res.json({ payments })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Get payment details for a specific booking
app.get("/payments/:bookingId", authenticate, async (req, res) => {
    try {
        const payment = await Payment.findOne({
            bookingId: req.params.bookingId,
            userId: req.user.id,
        })

        if (!payment) return res.status(404).json({ error: "Payment not found" })
        res.json({ payment })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Triggered by booking service when a user reaches 3 completed bookings
app.post("/internal/unlock-discount", async (req, res) => {
    try {
        const { userId } = req.body
        if (!userId) return res.status(400).json({ error: "userId required" })

        let discount
        try {
            discount = await DiscountNotification.create({ userId })
        } catch (err) {
            if (err.code === 11000) return res.json({ message: "Discount already unlocked" })
            throw err
        }

        // Trigger event to notify the user about their discount
        paymentEvents.emit("discount:unlocked", { userId, discount })

        res.status(201).json({ message: "Discount unlocked", discountNotification: discount })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Payment] Service is running on port ${PORT}`))