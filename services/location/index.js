require("dotenv").config()
const express = require("express")
const cors = require("cors")
const mongoose = require("mongoose")
const axios = require("axios")

const { Location } = require("./models/index")
const { authenticate } = require("./middleware")

const PORT = process.env.PORT || 3005

const app = express()
app.use(cors())
app.use(express.json())

// Connect to db
mongoose
    .connect(process.env.MONGODB_CONN)
    .then(() => console.log("[Location] Connected to MongoDB"))
    .catch(err => { console.error("[Location] DB error:", err); process.exit(1) })

async function getWeatherForecast({ lat, lng, address }) {
    let q
    if (lat != null && lng != null)
        q = `${lat},${lng}`
    else if(q)
        q = address
    else 
        return { error: "Failed to build query (lat and lng, or address are required)" }

    try {
        const { data } = await axios.get(`${process.env.WEATHER_API_URL}/forecast.json`, {
            params: { q, days: 1 },
            headers: {
                "X-RapidAPI-Key": process.env.RAPID_API_KEY,
                "X-RapidAPI-Host": new URL(process.env.RAPID_API_HOST),
            },
        })

        return {
            location: {
                name: data.location?.name,
                region: data.location?.region,
                country: data.location?.country,
                localtime: data.location?.localtime,
            },
            current: {
                tempC: data.current?.temp_c,
                condition: data.current?.condition?.text,
                icon: data.current?.condition?.icon,
                windKph: data.current?.wind_kph,
                humidity: data.current?.humidity,
            },
            forecastDay: data.forecast?.forecastday?.[0]?.day && {
                maxTempC: data.forecast.forecastday[0].day.maxtemp_c,
                minTempC: data.forecast.forecastday[0].day.mintemp_c,
                condition: data.forecast.forecastday[0].day.condition?.text,
                chanceOfRain: data.forecast.forecastday[0].day.daily_chance_of_rain,
            },
        }
    } catch (err) {
        console.error("[Location] Weather API error:", err.response?.data || err.message)
        return { error: "Weather lookup failed" }
    }
}

// Routes

// Add a favourite pickup location
app.post("/locations", authenticate, async (req, res) => {
    try {
        const { label, address, lat, lng } = req.body

        if (!label || !address)
            return res.status(400).json({ error: "Label and address are required" })

        const location = await Location.create({
            userId: req.user.id,
            label,
            address,
            lat,
            lng,
        })

        res.status(201).json({ message: "Location added", location })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Update a favourite pickup location
app.patch("/locations/:id", authenticate, async (req, res) => {
    try {
        const { label, address, lat, lng } = req.body

        const update = {}
        if (label !== undefined) update.label = label
        if (address !== undefined) update.address = address
        if (lat !== undefined) update.lat = lat
        if (lng !== undefined) update.lng = lng

        const location = await Location.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: update },
            { new: true }
        )

        if (!location) return res.status(404).json({ error: "Location not found" })

        res.json({ message: "Location updated", location })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Remove a favourite pickup location
app.delete("/locations/:id", authenticate, async (req, res) => {
    try {
        const location = await Location.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        })

        if (!location) return res.status(404).json({ error: "Location not found" })

        res.json({ message: "Location removed" })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// List the user's favourite pickup locations
app.get("/locations", authenticate, async (req, res) => {
    try {
        const locations = await Location.find({ userId: req.user.id }).sort({ createdAt: -1 })
        res.json({ locations })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

// Get weather forecast for a saved location
app.get("/locations/:id/weather", authenticate, async (req, res) => {
    try {
        const location = await Location.findOne({
            _id: req.params.id,
            userId: req.user.id,
        })

        if (!location) return res.status(404).json({ error: "Location not found" })

        const forecast = await getWeatherForecast({
            lat: location.lat,
            lng: location.lng,
            address: location.address,
        })
        res.json({ location, forecast })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Location] Service is running on port ${PORT}`))
