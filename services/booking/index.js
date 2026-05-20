require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")
const axios = require("axios")

const { Booking } = require("./models/index");
const { authenticate } = require('./middleware')

const PORT = process.env.PORT || 3002
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL

const app = express()
app.use(cors())
app.use(express.json())

async function scheduleRideReadyNotification(booking) {
    // Set booking status to DRIVER_ASSIGNED
    await Booking.findByIdAndUpdate(booking._id, { status: "DRIVER_ASSIGNED" })

    setTimeout(async () => {
        try {
            // Push the ride-ready notification to the user's inbox
            await axios.post(`${CUSTOMER_SERVICE_URL}/internal/notifications`, {
                userId: booking.userId,
                type: "RIDE_READY",
                title: "Your cab is ready for pickup",
                message: `Your ${booking.cabType} cab is on its way.`,
                meta: {
                    bookingId: booking._id,
                    cabType: booking.cabType,
                    passengers: booking.passengers,
                    startLocation: booking.startLocation,
                    endLocation: booking.endLocation,
                    bookingTime: booking.bookingTime,
                },
            })

            await Booking.findByIdAndUpdate(booking._id, { status: "IN_PROGRESS" })
        } catch (err) {
            console.error("[Booking] Failed to send ride-ready notification:", err.message)
        }
    }, 3 * 60 * 1000); // 3 minutes
}

async function setBookingComplete(bookingId) {
    const booking = await Booking.findOneAndUpdate(
        { _id: bookingId, status: { $in: ["IN_PROGRESS", "DRIVER_ASSIGNED", "CONFIRMED"] } },
        { $set: { status: "COMPLETED" } },
        { new: true }
    )
    if (!booking) return null

    let bookingCount = null
    try {
        const { data } = await axios.post(`${CUSTOMER_SERVICE_URL}/internal/booking-complete`, 
            { userId: booking.userId }
        )
        bookingCount = data.bookingCount
    } catch (err) {
        console.error("[Booking] booking-complete call failed:", err.message)
    }

    // Trigger discount unlock exactly when the user hits 3
    if (bookingCount === 3) {
        try {
            await axios.post(`${PAYMENT_SERVICE_URL}/internal/unlock-discount`, 
                { userId: booking.userId }
            )
        } catch (err) {
            console.error("[Booking] unlock-discount call failed:", err.message)
        }
    }

    return booking
}

// Connect to db
mongoose
    .connect(process.env.MONGODB_CONN)
    .then(() => console.log("[Booking] Connected to MongoDB"))
    .catch(err => { console.error("[Booking] DB error:", err); process.exit(1) })

// Routes

// Create booking
app.post("/internal/booking", authenticate, async (req, res) => {
    try {
        const {
            startLocation,
            endLocation,
            dateTime,
            passengers,
            cabType
        } = req.body

        if (!startLocation || !endLocation || !dateTime || !passengers || !cabType)
            return res.status(400).json({ error: "All booking fields are required" })

        if (passengers > 8)
            return res.status(400).json({ error: "Maximum 8 passengers allowed" })

        const userId = req.user.id

        const booking = await Booking.create({
            userId: userId,
            startLocation,
            endLocation,
            bookingTime: new Date(dateTime),
            passengers,
            cabType,
        })

        res.status(201).json({ message: "Booking pending payment", booking })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Confirm a booking once payment succeeds (called by payment service)
app.post("/internal/bookings/:id/confirm", authenticate, async (req, res) => {
    try {
        const booking = await Booking.findOneAndUpdate(
            { _id: req.params.id, status: "PAYING" },
            { $set: { status: "CONFIRMED" } },
            { new: true }
        )

        if (!booking)
            return res.status(404).json({ error: "Booking not found or already payed" })

        // Task 6 - schedule the ride-ready notification 3 minutes from confirmation
        scheduleRideReadyNotification(booking)

        res.json({ message: "Booking confirmed", booking })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Set a ride as completed
app.post("/internal/bookings/:id/complete", authenticate, async (req, res) => {
    try {
        const booking = await setBookingComplete(req.params.id)
        if (!booking) return res.status(404).json({ error: "Booking not found" })
        res.json({ message: "Booking completed", booking })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// View current bookings
app.get("/bookings/current", authenticate, async (req, res) => {
    try {
        const bookings = await Booking.find({
            userId: req.user.id,
            status: { $in: ["PAYING", "CONFIRMED", "DRIVER_ASSIGNED", "IN_PROGRESS"] },
        }).sort({ bookingTime: 1 }) // 1 = ascending / -1 = descending

        res.json({ bookings })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// View past bookings
app.get("/bookings/past", authenticate, async (req, res) => {
    try {
        const bookings = await Booking.find({
            userId: req.user.id,
            status: { $in: ["COMPLETED", "CANCELLED"] },
        }).sort({ bookingTime: -1 })

        res.json({ bookings })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Booking] Service is running on port ${PORT}`))