const mongoose = require("mongoose")

const bookingSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    startLocation: { type: String, required: true },
    endLocation: { type: String, required: true },
    bookingTime: { type: Date, required: true },
    passengers: { type: Number, required: true, min: 1, max: 8 }, // payment service accepts upto 8
    cabType: { type: String, enum: ["Economic", "Premium", "Executive"], required: true },
    status: {
      type: String,
      enum: [
        "CONFIRMED", 
        "DRIVER_ASSIGNED", 
        "IN_PROGRESS", 
        "COMPLETED", 
        "CANCELLED"
      ],
      default: "CONFIRMED",
    },
    estimatedFare: { type: Number, default: 0 }, // from fare estimation service
    totalPrice: { type: Number, default: 0 } // final price after all multipliers
  },
  { timestamps: true }
)

module.exports = mongoose.model("Booking", bookingSchema)
