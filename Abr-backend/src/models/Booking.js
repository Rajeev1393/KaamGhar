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
    totalAmount: { type: Number, min: 0 },
    commissionAmount: { type: Number, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refund_required"],
      default: "unpaid",
      index: true
    },
    paymentOrderId: { type: String, trim: true, index: true },
    paymentOrderExpiresAt: { type: Date },
    paymentId: { type: String, trim: true },
    paidAt: { type: Date },
    providerPayoutStatus: {
      type: String,
      enum: ["pending", "cleared"],
      default: "pending",
      index: true
    },
    providerPayoutClearedAt: { type: Date },
    providerPayoutClearedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    providerPayoutReference: { type: String, trim: true, maxlength: 100 }
  },
  { timestamps: true }
);

bookingSchema.index({ worker: 1, paymentStatus: 1, providerPayoutStatus: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
