const mongoose = require("mongoose");

const verificationDocumentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["identity", "address", "certificate", "other"],
      required: true
    },
    originalName: { type: String, required: true, maxlength: 180 },
    storageName: { type: String, required: true, select: false },
    mimeType: { type: String, enum: ["application/pdf", "image/jpeg", "image/png"], required: true },
    size: { type: Number, required: true, min: 1, max: 5 * 1024 * 1024 },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
    reviewedAt: { type: Date },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const workerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true, sparse: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    profession: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true, index: true },
    city: { type: String, required: true, trim: true, index: true },
    experience: { type: Number, required: true, min: 0 },
    rating: { type: Number, required: true, min: 0, max: 5, default: 4.8 },
    reviewCount: { type: Number, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 },
    priceUnit: { type: String, enum: ["hour"], default: "hour" },
    image: { type: String, default: "" },
    description: { type: String, trim: true, maxlength: 300 },
    verificationDocuments: { type: [verificationDocumentSchema], default: [] },
    available: { type: Boolean, default: true },
    deletedAt: { type: Date },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Worker", workerSchema);
