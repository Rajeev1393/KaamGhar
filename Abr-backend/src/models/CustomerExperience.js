const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  worker: { type: mongoose.Schema.Types.ObjectId, ref: "Worker", required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });
reviewSchema.index({ worker: 1, createdAt: -1 });

const complaintSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", index: true },
  kind: { type: String, enum: ["complaint", "dispute"], required: true },
  subject: { type: String, required: true, maxlength: 100 },
  details: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ["open", "in_review", "resolved"], default: "open" },
  response: { type: String, maxlength: 2000 }
}, { timestamps: true });
complaintSchema.index({ customer: 1, createdAt: -1 });
complaintSchema.index({ status: 1, updatedAt: -1 });

module.exports = {
  Review: mongoose.model("Review", reviewSchema),
  Complaint: mongoose.model("Complaint", complaintSchema)
};
