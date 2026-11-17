const express = require("express");
const rateLimit = require("express-rate-limit").rateLimit;
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/authenticate");
const bookingsController = require("../controllers/bookingsController");

const router = express.Router();
const bookingRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many booking requests. Please try again later." }
});

router.use(authenticate);
router.get("/", authorize("customer", "worker", "admin"), asyncHandler(bookingsController.listMine));
router.post("/", authorize("customer"), bookingRequestLimiter, asyncHandler(bookingsController.create));
router.patch("/:id/status", authorize("customer", "worker", "admin"), asyncHandler(bookingsController.changeStatus));

module.exports = router;
