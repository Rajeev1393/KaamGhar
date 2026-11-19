const mongoose = require("mongoose");
const fs = require("node:fs/promises");
const path = require("node:path");
const Booking = require("../models/Booking");
const User = require("../models/User");
const Worker = require("../models/Worker");
const ServiceCategory = require("../models/ServiceCategory");
const httpError = require("../utils/httpError");
const { getWorkerDocumentPath } = require("../utils/workerDocuments");
const { findServiceCategory, getCategoryPricing, getServiceCategories, setServiceCategories } = require("../config/serviceCategories");
const { emailPattern, phonePattern, requiredString } = require("../middleware/validate");

async function listCategories(req, res) {
  res.json({ categories: getServiceCategories() });
}

async function createCategory(req, res) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw httpError(400, "Please submit valid category details.");
  }
  if (typeof req.body.name !== "string") throw httpError(400, "Category name is required.");
  const name = req.body.name.trim();
  if (name.length < 2 || name.length > 60) {
    throw httpError(400, "Category name must be between 2 and 60 characters.");
  }
  if (req.body.label !== undefined && typeof req.body.label !== "string") {
    throw httpError(400, "Category label must be text.");
  }
  const label = typeof req.body.label === "string" && req.body.label.trim()
    ? req.body.label.trim()
    : name;
  if (label.length > 80) throw httpError(400, "Category label must be 80 characters or fewer.");
  const normalizedName = name.toLowerCase();
  const existingCategory = await ServiceCategory.findOne({ normalizedName });
  if (existingCategory?.active) {
    throw httpError(409, "A category with this name already exists.");
  }
  let category;
  try {
    if (existingCategory) {
      existingCategory.name = name;
      existingCategory.label = label;
      existingCategory.price = 500;
      existingCategory.commission = undefined;
      existingCategory.active = true;
      category = await existingCategory.save();
    } else {
      category = await ServiceCategory.create({ name, label, normalizedName, price: 500 });
    }
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "A category with this name already exists.");
    throw error;
  }
  setServiceCategories([...getServiceCategories(), category]);
  res.status(201).json({ category: { name: category.name, label: category.label, price: category.price } });
}

async function updateCategoryPrice(req, res) {
  const name = requiredString(req.params.name, "Category name", 2, 60);
  if (!req.body || typeof req.body.price !== "number" || !Number.isFinite(req.body.price) ||
      req.body.price < 1 || req.body.price > 1000000) {
    throw httpError(400, "Category price must be between ₹1 and ₹1,000,000.");
  }
  const normalizedName = name.toLowerCase();
  const category = await ServiceCategory.findOne({ normalizedName, active: true });
  if (!category) throw httpError(404, "Service category was not found.");
  const { price, commission = category.commission } = req.body;
  if (req.body.commission !== undefined || commission?.type) {
    if (commission?.type !== "percentage" && commission?.type !== "fixed") {
      throw httpError(400, "Choose percentage or fixed commission.");
    }
    const max = commission.type === "percentage" ? 100 : price;
    if (typeof commission.value !== "number" || !Number.isFinite(commission.value) ||
        commission.value < 0 || commission.value > max) {
      throw httpError(400, commission.type === "percentage"
        ? "Commission must be between 0% and 100%."
        : "Fixed commission must be between ₹0 and the category price.");
    }
    category.commission = { type: commission.type, value: commission.value };
  }
  category.price = price;
  await category.save();
  setServiceCategories([
    ...getServiceCategories().filter((current) => current.name.toLowerCase() !== normalizedName),
    category
  ]);
  res.json({ category: findServiceCategory(name) });
}

async function deleteCategory(req, res) {
  const name = requiredString(req.params.name, "Category name", 2, 60);
  const normalizedName = name.toLowerCase();
  const category = await ServiceCategory.findOne({ normalizedName, active: true });
  if (!category) throw httpError(404, "Service category was not found.");
  if (await Worker.exists({ category: category.name, deletedAt: { $exists: false } })) {
    throw httpError(409, "This category is assigned to professionals. Reassign them before deleting it.");
  }
  category.active = false;
  await category.save();
  setServiceCategories(getServiceCategories().filter(
    (current) => current.name.toLowerCase() !== normalizedName
  ));
  res.json({ message: "Category deleted.", category: { name: category.name } });
}

async function createProfessional(req, res) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw httpError(400, "Please submit valid professional details.");
  }
  const name = requiredString(req.body.name, "Name", 2, 80);
  const email = requiredString(req.body.email, "Email", 3, 254).toLowerCase();
  const phone = requiredString(req.body.phone, "Phone", 8, 20);
  const password = req.body.password;
  const profession = requiredString(req.body.profession, "Service", 2, 80);
  const categoryName = requiredString(req.body.category, "Service category", 2, 60);
  const city = requiredString(req.body.city, "Location", 2, 80);
  const serviceCategory = findServiceCategory(categoryName);

  if (!emailPattern.test(email) || !phonePattern.test(phone)) {
    throw httpError(400, "Please enter a valid email address and phone number.");
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 72) {
    throw httpError(400, "Password must be 8 to 72 characters long.");
  }
  if (!serviceCategory) throw httpError(400, "Choose a service category from the list.");
  if (await User.exists({ email })) throw httpError(409, "An account with this email already exists.");

  const user = new User({ name, email, phone, password, role: "worker", active: true });
  await user.save();
  let worker;
  try {
    worker = await Worker.create({
      user: user._id,
      name,
      profession,
      category: serviceCategory.name,
      city,
      experience: 0,
      ...getCategoryPricing(serviceCategory),
      priceUnit: "hour",
      approvalStatus: "pending",
      available: false
    });
    user.worker = worker._id;
    await user.save();
  } catch (error) {
    try {
      if (worker) await Worker.deleteOne({ _id: worker._id });
    } finally {
      await User.deleteOne({ _id: user._id });
    }
    throw error;
  }

  res.status(201).json({ message: "Professional account created and awaiting review.", worker });
}

async function overview(req, res) {
  const [customers, professionals, pendingApprovals, pendingDocuments, bookings, revenue, paymentsReceived, recentBookings] =
    await Promise.all([
      User.countDocuments({ role: "customer" }),
      Worker.countDocuments({ approvalStatus: "approved", deletedAt: { $exists: false } }),
      Worker.countDocuments({ approvalStatus: "pending", deletedAt: { $exists: false } }),
      Worker.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $unwind: "$verificationDocuments" },
        { $match: { "verificationDocuments.status": "pending" } },
        { $count: "total" }
      ]),
      Booking.countDocuments(),
      Booking.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } }
      ]),
      Booking.aggregate([
        { $match: { paymentStatus: { $in: ["paid", "refund_required"] } } },
        { $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
          count: { $sum: 1 },
          commission: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$commissionAmount", 0] } },
          providerAmount: { $sum: { $cond: [
            { $eq: ["$paymentStatus", "paid"] },
            { $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$commissionAmount", 0] }] },
            0
          ] } }
        } }
      ]),
      Booking.find()
        .populate("customer", "name")
        .populate("worker", "name profession")
        .sort({ createdAt: -1 })
        .limit(8)
        .lean()
    ]);

  res.json({
    stats: {
      customers,
      professionals,
      pendingApprovals,
      pendingDocuments: pendingDocuments[0]?.total || 0,
      bookings,
      completedRevenue: revenue[0] ? revenue[0].total : 0,
      paymentsReceived: paymentsReceived[0] ? paymentsReceived[0].total : 0,
      paymentsReceivedCount: paymentsReceived[0] ? paymentsReceived[0].count : 0,
      commissionReceived: paymentsReceived[0]?.commission ?? 0,
      providerAmountReceived: paymentsReceived[0]?.providerAmount ?? 0
    },
    recentBookings
  });
}

async function listBookings(req, res) {
  const bookings = await Booking.find()
    .populate("customer", "name email phone")
    .populate("worker", "name profession category city")
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();
  res.json({ bookings });
}

async function getProviderPayoutTotals(workerIds) {
  if (!workerIds.length) return new Map();
  const summaries = await Booking.aggregate([
    { $match: { worker: { $in: workerIds }, paymentStatus: "paid" } },
    { $set: { providerAmount: { $round: [{ $subtract: [{ $ifNull: ["$totalAmount", 0] }, { $ifNull: ["$commissionAmount", 0] }] }, 2] } } },
    {
      $group: {
        _id: "$worker",
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
  return new Map(summaries.map((summary) => [
    String(summary._id),
    { total: summary.total, pending: summary.pending, cleared: summary.cleared }
  ]));
}

async function listProfessionals(req, res) {
  const status = req.query.status || "pending";
  if (!["pending", "approved", "rejected"].includes(status)) {
    throw httpError(400, "Invalid approval status.");
  }
  const workers = await Worker.find({ approvalStatus: status, deletedAt: { $exists: false } })
    .populate("user", "name email phone createdAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const payoutTotalsByWorker = await getProviderPayoutTotals(workers.map((worker) => worker._id));
  res.json({
    workers: workers.map((worker) => ({
      ...worker,
      earnings: payoutTotalsByWorker.get(String(worker._id)) || { total: 0, pending: 0, cleared: 0 }
    }))
  });
}

async function clearProfessionalPayouts(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid professional id.");
  if (req.body !== undefined && (!req.body || typeof req.body !== "object" || Array.isArray(req.body))) {
    throw httpError(400, "Please submit valid payout details.");
  }
  let reference;
  if (req.body?.reference !== undefined) {
    if (typeof req.body.reference !== "string") throw httpError(400, "Payout reference must be text.");
    reference = req.body.reference.trim();
    if (!reference || reference.length > 100) {
      throw httpError(400, "Payout reference must be between 1 and 100 characters.");
    }
  }
  const worker = await Worker.findOne({ _id: req.params.id, deletedAt: { $exists: false } }).select("_id");
  if (!worker) throw httpError(404, "Professional profile was not found.");

  const session = await mongoose.startSession();
  let payout;
  try {
    await session.withTransaction(async () => {
      const pendingBookings = await Booking.find({
        worker: worker._id,
        paymentStatus: "paid",
        providerPayoutStatus: { $ne: "cleared" }
      })
        .select("_id totalAmount commissionAmount")
        .session(session)
        .lean();
      if (!pendingBookings.length) throw httpError(409, "There is no pending payout for this professional.");

      const clearedAt = new Date();
      const update = {
        providerPayoutStatus: "cleared",
        providerPayoutClearedAt: clearedAt,
        providerPayoutClearedBy: req.user._id
      };
      if (reference) update.providerPayoutReference = reference;
      const result = await Booking.updateMany(
        {
          _id: { $in: pendingBookings.map((booking) => booking._id) },
          paymentStatus: "paid",
          providerPayoutStatus: { $ne: "cleared" }
        },
        { $set: update },
        { session }
      );
      if (result.modifiedCount !== pendingBookings.length) {
        throw httpError(409, "Payout records changed. Refresh and try again.");
      }
      payout = {
        amount: pendingBookings.reduce((paise, booking) =>
          paise + Math.round((booking.totalAmount || 0) * 100) - Math.round((booking.commissionAmount || 0) * 100), 0
        ) / 100,
        bookingCount: pendingBookings.length,
        clearedAt,
        reference: reference || null
      };
    });
  } finally {
    await session.endSession();
  }
  res.json({ message: "Payout marked as cleared.", payout });
}

async function updateProfessionalStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid professional id.");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw httpError(400, "Please submit a valid professional status.");
  }
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    throw httpError(400, "Status must be approved or rejected.");
  }
  if (status === "approved") {
    const workerToApprove = await Worker.findOne({ _id: req.params.id, deletedAt: { $exists: false } }).select("verificationDocuments");
    if (!workerToApprove) throw httpError(404, "Professional profile was not found.");
    if (workerToApprove.verificationDocuments.some((document) => document.status !== "verified")) {
      throw httpError(409, "Verify all uploaded documents before approving this professional.");
    }
  }
  const worker = await Worker.findOneAndUpdate(
    { _id: req.params.id, deletedAt: { $exists: false } },
    {
      $set: {
        approvalStatus: status,
        available: status === "approved"
      }
    },
    { new: true, runValidators: true }
  );
  if (!worker) throw httpError(404, "Professional profile was not found.");
  res.json({ message: `Professional ${status}.`, worker });
}

async function deleteProfessional(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid professional id.");

  const session = await mongoose.startSession();
  const documentPaths = [];
  try {
    await session.withTransaction(async () => {
      const worker = await Worker.findById(req.params.id)
        .select("+verificationDocuments.storageName")
        .session(session);
      if (!worker || worker.deletedAt) throw httpError(404, "Professional profile was not found.");

      for (const document of worker.verificationDocuments) {
        const filePath = getWorkerDocumentPath(document.storageName);
        if (!filePath) throw httpError(500, "A stored verification document has an invalid path.");
        documentPaths.push(filePath);
      }

      const userId = worker.user;
      worker.deletedAt = new Date();
      worker.available = false;
      worker.name = "Deleted employee";
      worker.city = "Removed";
      worker.description = "";
      worker.image = "";
      worker.user = undefined;
      worker.verificationDocuments = [];
      await worker.save({ session });

      if (userId) {
        const result = await User.deleteOne({ _id: userId, role: "worker" }).session(session);
        if (!result.deletedCount) throw httpError(409, "Professional account was not found; the employee was not deleted.");
      }
    });
  } finally {
    await session.endSession();
  }

  let cleanupFailed = false;
  for (const filePath of documentPaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error.code !== "ENOENT") {
        cleanupFailed = true;
        console.error("Could not remove a private verification document after employee deletion.", error);
      }
    }
  }
  if (cleanupFailed) {
    throw httpError(500, "Employee removed, but some private verification documents could not be deleted.");
  }

  res.json({ message: "Employee deleted; booking history preserved.", workerId: req.params.id });
}

async function updateDocumentStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.documentId)) {
    throw httpError(400, "Invalid professional or document id.");
  }
  if (!req.body || !["verified", "rejected"].includes(req.body.status)) {
    throw httpError(400, "Document status must be verified or rejected.");
  }
  const worker = await Worker.findOne({ _id: req.params.id, deletedAt: { $exists: false } });
  if (!worker) throw httpError(404, "Professional profile was not found.");
  const document = worker.verificationDocuments.id(req.params.documentId);
  if (!document) throw httpError(404, "Verification document was not found.");
  document.status = req.body.status;
  document.reviewedAt = new Date();
  await worker.save();
  res.json({ message: `Document ${document.status}.`, document });
}

async function sendDocument(req, res, next) {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.documentId)) {
    throw httpError(400, "Invalid professional or document id.");
  }
  const worker = await Worker.findOne({ _id: req.params.id, deletedAt: { $exists: false } }).select("+verificationDocuments.storageName");
  if (!worker) throw httpError(404, "Professional profile was not found.");
  const document = worker.verificationDocuments.id(req.params.documentId);
  if (!document) throw httpError(404, "Verification document was not found.");
  const filePath = getWorkerDocumentPath(document.storageName);
  if (!filePath) throw httpError(404, "Verification document file was not found.");
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error.code === "ENOENT") throw httpError(404, "Verification document file was not found.");
    throw error;
  }
  res.set({
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${path.basename(document.originalName)}"`,
    "Content-Type": document.mimeType,
    "X-Content-Type-Options": "nosniff"
  });
  res.sendFile(filePath, (error) => {
    if (error) next(error);
  });
}

async function listUsers(req, res) {
  const role = req.query.role;
  if (role && !["customer", "worker"].includes(role)) {
    throw httpError(400, "Choose a customer or professional role.");
  }
  const approvedWorkerUserIds = role === "customer"
    ? []
    : await Worker.find({ approvalStatus: "approved", deletedAt: { $exists: false }, user: { $exists: true } }).distinct("user");
  const userFilter = role === "customer"
    ? { role: "customer" }
    : role === "worker"
      ? { role: "worker", _id: { $in: approvedWorkerUserIds } }
      : { $or: [{ role: "customer" }, { role: "worker", _id: { $in: approvedWorkerUserIds } }] };
  const users = await User.find(userFilter)
    .select("name email phone role active worker createdAt")
    .populate("worker", "profession category approvalStatus")
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  const payoutTotalsByWorker = await getProviderPayoutTotals(
    users.filter((account) => account.role === "worker" && account.worker?._id)
      .map((account) => account.worker._id)
  );
  res.json({
    users: users.map((account) => account.role === "worker" && account.worker
      ? {
          ...account,
          worker: {
            ...account.worker,
            earnings: payoutTotalsByWorker.get(String(account.worker._id)) || { total: 0, pending: 0, cleared: 0 }
          }
        }
      : account)
  });
}

async function updateUserStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw httpError(400, "Invalid user id.");
  if (!req.body || typeof req.body.active !== "boolean") {
    throw httpError(400, "User active status must be true or false.");
  }
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, role: { $in: ["customer", "worker"] } },
    { $set: { active: req.body.active } },
    { new: true, runValidators: true }
  ).select("name email phone role active createdAt");
  if (!user) throw httpError(404, "Customer or professional account was not found.");
  res.json({ message: `Account ${user.active ? "activated" : "deactivated"}.`, user });
}

module.exports = {
  createCategory,
  deleteCategory,
  createProfessional,
  listCategories,
  listBookings,
  listUsers,
  overview,
  clearProfessionalPayouts,
  sendDocument,
  updateDocumentStatus,
  updateProfessionalStatus,
  updateCategoryPrice,
  deleteProfessional,
  updateUserStatus,
  listProfessionals
};
