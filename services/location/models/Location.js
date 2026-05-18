const mongoose = require("mongoose")

const locationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number },
    lng: { type: Number },
  },
  { timestamps: true }
)

module.exports = mongoose.model("Location", locationSchema)