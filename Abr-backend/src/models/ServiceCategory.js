const mongoose = require("mongoose");

const serviceCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    label: { type: String, required: true, trim: true, maxlength: 80 },
    normalizedName: { type: String, required: true, unique: true, select: false },
    price: { type: Number, required: true, min: 1, max: 1000000, default: 500 },
    commission: {
      type: { type: String, enum: ["percentage", "fixed"] },
      value: { type: Number, min: 0 }
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ServiceCategory", serviceCategorySchema);
