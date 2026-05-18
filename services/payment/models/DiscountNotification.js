const mongoose = require("mongoose")

const discountNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  sentAt: { type: Date, default: Date.now },
})

module.exports = mongoose.model("DiscountNotification", discountNotificationSchema)