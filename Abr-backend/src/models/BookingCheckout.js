const mongoose = require("mongoose");

const bookingCheckoutSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
    customerName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, required: true, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    scheduledAt: { type: Date, required: true },
    durationHours: { type: Number, min: 1, max: 12, required: true },
    notes: { type: String, trim: true, maxlength: 500, default: "" },
    totalAmount: { type: Number, min: 1, required: true },
    commissionAmount: { type: Number, min: 0 },
    paymentOrderId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    paymentId: { type: String, trim: true },
    paidAt: { type: Date },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" }
  },
  { timestamps: true }
);

bookingCheckoutSchema.index({ customer: 1, status: 1 });
bookingCheckoutSchema.index(
  { customer: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

module.exports = mongoose.model("BookingCheckout", bookingCheckoutSchema);
