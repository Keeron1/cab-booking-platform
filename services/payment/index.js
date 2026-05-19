require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const axios = require("axios")

const { Payment, DiscountNotification } = require("./models/index");
const { authenticate } = require('./middleware')

const PORT = process.env.PORT || 3003
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL
const BOOKING_SERVICE_URL = process.env.BOOKING_SERVICE_URL

const app = express()
app.use(cors())
app.use(express.json())

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

async function getCabFare() {
    return 10
}

// Routes

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

        const cabMultiplier = getCabMultiplier(cabType)
        if (cabMultiplier === null)
            return res.status(400).json({ error: "Invalid cab type" })

        const passengersMultiplier = getPassengersMultiplier(passengers)
        if (passengersMultiplier === null)
            return res.status(400).json({ error: "Maximum 8 passengers allowed" })

        const daytimeMultiplier = getDaytimeMultiplier(dateTime)

        const baseFare = await getCabFare(startLocation, endLocation)

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

        // Calculate total fare cost
        const totalPrice =
            baseFare *
            cabMultiplier *
            daytimeMultiplier *
            passengersMultiplier *
            discountMultiplier

        // Create payment record
        const payment = await Payment.create({
            userId: req.user.id,
            bookingId: booking._id,
            baseFare,
            cabMultiplier,
            daytimeMultiplier,
            passengersMultiplier,
            discountMultiplier,
            totalPrice,
            discountApplied
        })

        // Change booking status to CONFIRMED
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

// Retrieve all the user's payments
app.get("/payments", authenticate, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.id }).sort({ createdAt: -1 })
        res.json({ payments })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Retrieve payment details for a specific booking
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

app.listen(PORT, () => console.log(`[Payment] Service is running on port ${PORT}`))