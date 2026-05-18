require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")

const { Booking } = require("./models/index");

const PORT = process.env.PORT || 3002
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL

const app = express()
app.use(cors())
app.use(express.json())

function scheduleRideReadyNotification(booking) {
    // Set booking status to DRIVER_ASSIGNED

    setTimeout(async () => {
        try {
            // Send notification that the ride is ready
            // notification that contains the details of the requested ride in the user microservice

        //   booking._id
        } catch (err) {
        console.error("[Booking] Failed to send ride-ready notification:", err.message);
        }
    }, 3 * 60 * 1000); // 3 minutes
}
async function setBookingComplete(userId) {
    try {
        // Increments booking count
        const { data } = await axios.post(`${CUSTOMER_SERVICE_URL}/internal/booking-complete`, { userId });
        return data.bookingCount;

        // Set booking status to COMPLETED
    } catch (err) {
        console.error("[Booking] Failed to set booking as complete:", err.message);
        return null;
    }
}

// Connect to db
mongoose
    .connect(process.env.MONGODB_CONN)
    .then(() => console.log("[Booking] Connected to MongoDB"))
    .catch(err => { console.error("[Booking] DB error:", err); process.exit(1) })

// Routes

// Create booking
app.post("/bookings", authenticate, async (req, res) => {
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


        // ------ Estimate and process payment
        // OR Create booking from payment service after the user pays

        // Create booking and confirm it
        // Task 2
        const booking = await Booking.create({
            userId: req.user.id,
            startLocation,
            endLocation,
            dateTime: new Date(dateTime),
            passengers,
            cabType,
            status: "CONFIRMED",
        })

        // Task 6 - (event-driven func) 
        // Notify the user that the cab is ready for pickup
        // scheduleRideReadyNotification(booking)

        // After user clicks Ride then set booking status to IN_PROGRESS

        // Task 5 - (event-driven func) IS THIS HERE OR AFTER THE BOOKING IS COMPLETE?
        // Increment booking count
        // const bookingCount = await setBookingComplete()
        // console.log(`[Booking] User ${req.user.id} now has ${bookingCount} bookings`)

        res.status(201).json({ message: "Booking confirmed", booking })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Booking] Service is running on port ${PORT}`))