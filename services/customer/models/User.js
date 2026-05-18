const mongoose = require("mongoose")
const bcrypt   = require("bcryptjs")

const userSchema = new mongoose.Schema({
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // used as username
    password: { type: String, required: true },
    bookingCount: { type: Number, default: 0 }, // tracks completed bookings for discount event
  },
  { timestamps: true }
)

// Hash password before saving document
userSchema.pre("save", async function () {
  // Checks if password has already been hashed
  if (!this.isModified("password")) return

  // Hash and save the password
  this.password = await bcrypt.hash(this.password, 10)
})

// Compare plain password against hashed password
userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password)
}

module.exports = mongoose.model("User", userSchema)