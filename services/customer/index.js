require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const jwt = require("jsonwebtoken")

const { User, Notification } = require("./models/index")

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
        const { firstName, surname, email, password } = req.body

        if (!firstName || !surname || !email || !password) {
            return res.status(400).json({ error: "All fields are required" })
        }

        const isUnique = await User.findOne({ email })
        if (isUnique) 
            return res.status(409).json({ error: "Email already registered" })
        
        // Add new user to db
        const user = await User.create({ firstName, surname, email, password })

        // Generate login token
        const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        })

        res.status(201).json({
            message: "User registered successfully",
            token,
            user: { id: user._id, 
                    firstName: user.firstName, 
                    surname: user.surname, 
                    email: user.email 
                }
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Customer] Service is running on port ${PORT}`))