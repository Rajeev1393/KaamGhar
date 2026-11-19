const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Worker = require("../models/Worker");
const { requiredString } = require("../middleware/validate");
const httpError = require("../utils/httpError");
const { findServiceCategory, getServiceCategories } = require("../config/serviceCategories");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listPublic(req, res) {
  const filters = { available: true, approvalStatus: "approved", deletedAt: { $exists: false } };
  const { category, city, search } = req.query;
  if (category && typeof category === "string" && category !== "All services") {
    filters.category = new RegExp(`^${escapeRegex(category.slice(0, 60))}$`, "i");
  }
  if (city && typeof city === "string") {
    filters.city = new RegExp(escapeRegex(city.slice(0, 80)), "i");
  }
  if (search && typeof search === "string") {
    const pattern = new RegExp(escapeRegex(search.slice(0, 80)), "i");
    filters.$or = [{ name: pattern }, { profession: pattern }, { category: pattern }];
  }
  const workers = await Worker.find(filters)
    .select("name profession category city experience rating reviewCount price priceUnit image description")
    .sort({ rating: -1, reviewCount: -1 })
    .limit(60)
    .lean();
  res.json({ workers });
}

async function listCategories(req, res) {
  res.json({ categories: getServiceCategories().map(({ name, label, price }) => ({ name, label, price })) });
}

async function getOwnProfile(req, res) {
  if (!req.user.worker) throw httpError(404, "Professional profile was not found.");
  const worker = await Worker.findOne({ _id: req.user.worker, user: req.user._id }).lean();
  if (!worker) throw httpError(404, "Professional profile was not found.");
  res.json({ worker });
}

async function getOwnEarnings(req, res) {
  if (!req.user.worker) throw httpError(404, "Professional profile was not found.");
  const [summary] = await Booking.aggregate([
    { $match: { worker: new mongoose.Types.ObjectId(req.user.worker), paymentStatus: "paid" } },
    { $set: { providerAmount: { $round: [{ $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$commissionAmount", 0] }] }, 2] } } },
    {
      $group: {
        _id: null,
        total: { $sum: "$providerAmount" },
        pending: {
          $sum: {
            $cond: [
              { $eq: ["$providerPayoutStatus", "cleared"] },
              0,
              "$providerAmount"
            ]
          }
        },
        cleared: {
          $sum: {
            $cond: [
              { $eq: ["$providerPayoutStatus", "cleared"] },
              "$providerAmount",
              0
            ]
          }
        }
      }
    }
  ]);
  res.json({
    earnings: {
      total: summary?.total || 0,
      pending: summary?.pending || 0,
      cleared: summary?.cleared || 0
    }
  });
}

async function updateOwnProfile(req, res) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw httpError(400, "Please submit valid profile details.");
  }
  const workerId = req.user.worker;
  if (!workerId) throw httpError(404, "Professional profile was not found.");
  const allowedFields = ["profession", "category", "city", "experience", "price", "description"];
  const update = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (update.profession !== undefined) update.profession = requiredString(update.profession, "Profession", 2, 80);
  if (update.category !== undefined) {
    update.category = requiredString(update.category, "Service category", 2, 60);
    const serviceCategory = findServiceCategory(update.category);
    if (!serviceCategory) throw httpError(400, "Choose a service category from the list.");
    update.category = serviceCategory.name;
  }
  if (update.city !== undefined) update.city = requiredString(update.city, "City", 2, 80);
  if (update.description !== undefined) update.description = requiredString(update.description, "Introduction", 10, 300);
  for (const field of ["experience", "price"]) {
    if (update[field] !== undefined) {
      update[field] = Number(update[field]);
      if (!Number.isFinite(update[field]) || update[field] < 0 || (field === "price" && update[field] === 0)) {
        throw httpError(400, `Please enter a valid ${field}.`);
      }
      update.priceUnit = "hour";
    }
  }
  if (req.body.available !== undefined) {
    if (typeof req.body.available !== "boolean") throw httpError(400, "Availability must be true or false.");
    update.available = req.body.available;
  }
  if (Object.keys(update).length === 0) throw httpError(400, "Provide at least one profile field to update.");

  const worker = await Worker.findOneAndUpdate(
    { _id: new mongoose.Types.ObjectId(workerId), user: req.user._id },
    { $set: update },
    { new: true, runValidators: true }
  );
  if (!worker) throw httpError(404, "Professional profile was not found.");
  res.json({ worker });
}

module.exports = { listPublic, listCategories, getOwnProfile, getOwnEarnings, updateOwnProfile };
