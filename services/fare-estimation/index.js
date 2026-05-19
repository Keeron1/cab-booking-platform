require("dotenv").config()
const express = require("express")
const cors = require("cors")
const axios = require("axios")

const { authenticate } = require("./middleware")

const PORT = process.env.PORT || 3004

const app = express()
app.use(cors())
app.use(express.json())

async function getTaxiFare({ startLat, startLng, endLat, endLng }) {
    try {
        const { data } = await axios.get(`${process.env.RAPID_API_FARE_HOST}/search-geo`, {
            params: {
                dep_lat: startLat,
                dep_lng: startLng,
                arr_lat: endLat,
                arr_lng: endLng
            },
            headers: {
                "X-RapidAPI-Key": process.env.RAPID_API_KEY,
                "X-RapidAPI-Host": new URL(process.env.RAPID_API_FARE_HOST).host,
            },
        })

        const price_in_cents = data?.journey?.fares?.[0].price_in_cents
        if(price_in_cents){
            return { error: "Failed to build response" }
        }

        return {
            price_in_cents = price_in_cents
        }
    } catch (err) {
        console.error("[Fare] API error:", err.response?.data || err.message)
        return { error: "Fare lookup failed" }
    }
}

// Get a taxi fare estimate
app.get("/internal/fare", authenticate, async (req, res) => {
    try {
        const { startLat, startLng, endLat, endLng } = req.query

        if (!startLat || !startLng || !endLat || !endLng)
            return res.status(400).json({ error: "startLat, startLng, endLat and endLng are required" })

        const result = await getTaxiFare({ startLat, startLng, endLat, endLng })
        if (result.error) return res.status(502).json({ error: result.error })

        res.json(result)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Server error" })
    }
})

app.listen(PORT, () => console.log(`[Fare] Service is running on port ${PORT}`))
