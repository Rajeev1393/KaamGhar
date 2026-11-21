const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  kind: { type: String, enum: ["fixed", "percent"], required: true },
  value: { type: Number, required: true },
  expiresAt: Date,
  active: { type: Boolean, default: true }
}, { timestamps: true });

const membershipPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  benefits: { type: String, required: true },
  price: { type: Number, required: true },
  days: { type: Number, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const referralProgramSchema = new mongoose.Schema({
  _id: String,
  enabled: { type: Boolean, default: false }
});

module.exports = {
  Coupon: mongoose.model("Coupon", couponSchema),
  MembershipPlan: mongoose.model("MembershipPlan", membershipPlanSchema),
  ReferralProgram: mongoose.model("ReferralProgram", referralProgramSchema)
};
