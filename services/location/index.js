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

    // Build query
    if (lat != null && lng != null) // Checks if null or undefined (0 is a coord)
        q = `${lat},${lng}`
    else if(address) q = address // Try to use address instead
    else return { error: "Failed to build query (lat and lng, or address are required)" }

    try {
        const { data } = await axios.get(`https://${process.env.RAPID_API_FORECAST_HOST}/forecast.json`, {
            params: { q, days: 1 },
            headers: {
                "X-RapidAPI-Key": process.env.RAPID_API_KEY,
                "X-RapidAPI-Host": process.env.RAPID_API_FORECAST_HOST,
            },
        })

        const weatherLocation = data.location
        const currentWeather = data.current
        const forecastDay = data.forecast?.forecastday?.[0]?.day    
        if(!forecastDay || !currentWeather || !weatherLocation){
            return { error: "Failed to build response" }
        }

        return {
            location: {
                name: weatherLocation?.name,
                region: weatherLocation?.region,
                country: weatherLocation?.country,
                localtime: weatherLocation?.localtime,
            },
            current: {
                tempC: currentWeather?.temp_c,
                condition: currentWeather?.condition?.text,
                windKph: currentWeather?.wind_kph,
                humidity: currentWeather?.humidity,
            },
            forecastDay: {
                maxTempC: forecastDay.maxtemp_c,
                minTempC: forecastDay.mintemp_c,
                condition: forecastDay.condition?.text,
                chanceOfRain: forecastDay.daily_chance_of_rain,
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
        if(forecast.error) return res.status(502).json({ error: forecast.error })

        res.json({ location, forecast })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Location] Service is running on port ${PORT}`))
