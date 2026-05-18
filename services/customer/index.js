require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")

const { User, Notification } = require("./models/index")
const { authenticate } = require('./middleware');

const PORT = process.env.PORT || 3001

const app = express()
app.use(cors())
app.use(express.json())

// Connect to db
mongoose
    .connect(process.env.MONGODB_CONN)
    .then(() => console.log("[Customer] Connected to MongoDB"))
    .catch(err => { console.error("[Customer] DB error:", err); process.exit(1) })

// Routes
app.post("/auth/register", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body

        if (!firstName || !lastName || !email || !password)
            return res.status(400).json({ error: "All fields are required" })

        const isUnique = await User.findOne({ email })
        if (isUnique)
            return res.status(409).json({ error: "Email already registered" })

        // Add new user to db
        const user = await User.create({ firstName, lastName, email, password })

        // Generate login token
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        })

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password)
            return res.status(400).json({ error: "Email and password are required" })

        const user = await User.findOne({ email })
        if (!user || !(await user.comparePassword(password)))
            return res.status(401).json({ error: "Invalid email or password" })

        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        })

        res.json({
            message: "Login successful",
            token,
            user: { id: user._id, firstName: user.firstName, surname: user.surname, email: user.email },
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
});

app.get("/account", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password")
        if (!user) return res.status(404).json({ error: "User not found" })
        res.json({ user })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
});

// Internal routes
app.post("/internal/booking-complete"), async (req, res) => {
    // Temp
    res.json({
        bookingCount : 3
    })
}

app.listen(PORT, () => console.log(`[Customer] Service is running on port ${PORT}`))