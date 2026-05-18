const mongoose = require("mongoose")

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["RIDE_READY", "DISCOUNT", "GENERAL"], default: "GENERAL" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }, // booking details, discount multiplier
  },
  { timestamps: true }
)

module.exports = mongoose.model("Notification", notificationSchema)
