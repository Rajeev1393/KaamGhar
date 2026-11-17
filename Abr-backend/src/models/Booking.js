const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
      required: true
    },
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    scheduledAt: { type: Date, required: true },
    durationHours: { type: Number, min: 1, max: 12, default: 1 },
    notes: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending",
      index: true
    },
    totalAmount: { type: Number, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
