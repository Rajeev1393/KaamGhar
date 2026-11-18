const express = require("express");
const rateLimit = require("express-rate-limit").rateLimit;
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/authenticate");
const bookingsController = require("../controllers/bookingsController");
const paymentsController = require("../controllers/paymentsController");

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
router.post("/", authorize("customer"), bookingRequestLimiter, (req, res) => {
  res.status(410).json({ message: "Create a payment order first using POST /api/bookings/payment/order." });
});
router.post("/payment/order", authorize("customer"), bookingRequestLimiter, asyncHandler(paymentsController.createBookingOrder));
router.post("/payment/verify", authorize("customer"), asyncHandler(paymentsController.verifyBookingPayment));
router.post("/:id/payment/order", authorize("customer"), asyncHandler(paymentsController.createOrder));
router.post("/:id/payment/verify", authorize("customer"), asyncHandler(paymentsController.verifyPayment));
router.patch("/:id/status", authorize("customer", "worker", "admin"), asyncHandler(bookingsController.changeStatus));

module.exports = router;
