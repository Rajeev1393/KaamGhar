const express = require("express");
const path = require("node:path");
const { rateLimit } = require("express-rate-limit");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/authenticate");
const { validateRegister, validateLogin } = require("../middleware/validate");
const loginRateLimiter = require("../middleware/loginRateLimiter");
const authController = require("../controllers/authController");
const passwordResetController = require("../controllers/passwordResetController");

const router = express.Router();
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many password reset attempts. Please try again later." }
});

router.get("/password-reset", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(__dirname, "..", "..", "public", "password-reset.html"));
});
router.get("/password-reset.js", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "password-reset.js"));
});
router.post("/forgot-password", resetLimiter, asyncHandler(passwordResetController.requestReset));
router.post("/reset-password", resetLimiter, asyncHandler(passwordResetController.resetPassword));

router.post("/register", validateRegister, asyncHandler(authController.register));
router.post("/login", loginRateLimiter, validateLogin, asyncHandler(authController.login));
router.post("/logout", asyncHandler(authController.logout));
router.get("/me", authenticate, asyncHandler(authController.me));

module.exports = router;
