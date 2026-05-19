const mongoose = require("mongoose")

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, required: true },

    baseFare: { type: Number, required: true }, // cab_fare
    cabMultiplier: { type: Number, required: true },
    daytimeMultiplier: { type: Number, required: true },
    passengersMultiplier: { type: Number, required: true },
    discountMultiplier: { type: Number, required: false, default: 1 },

    totalPrice: { type: Number, required: true },
    discountApplied:{ type: Boolean, default: false }
  },
  { timestamps: true }
)

module.exports = mongoose.model("Payment", paymentSchema)