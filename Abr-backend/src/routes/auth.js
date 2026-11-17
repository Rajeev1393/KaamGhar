const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate } = require("../middleware/authenticate");
const { validateRegister, validateLogin } = require("../middleware/validate");
const loginRateLimiter = require("../middleware/loginRateLimiter");
const authController = require("../controllers/authController");

const router = express.Router();

router.post("/register", validateRegister, asyncHandler(authController.register));
router.post("/login", loginRateLimiter, validateLogin, asyncHandler(authController.login));
router.post("/logout", asyncHandler(authController.logout));
router.get("/me", authenticate, asyncHandler(authController.me));

module.exports = router;
