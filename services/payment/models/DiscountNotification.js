const mongoose = require("mongoose")

const discountNotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  sentAt: { type: Date, default: Date.now },
  usedAt: { type: Date, default: null }, // NULL = discount not yet redeemed
})

module.exports = mongoose.model("DiscountNotification", discountNotificationSchema)