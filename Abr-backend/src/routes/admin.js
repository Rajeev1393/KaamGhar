const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const { authenticate, authorize } = require("../middleware/authenticate");
const { validateLogin } = require("../middleware/validate");
const loginRateLimiter = require("../middleware/loginRateLimiter");
const authController = require("../controllers/authController");
const adminController = require("../controllers/adminController");

const router = express.Router();
router.post("/auth/login", loginRateLimiter, validateLogin, asyncHandler(authController.adminLogin));
router.post("/auth/logout", asyncHandler(authController.logoutAdmin));
router.get("/auth/me", authenticate, authorize("admin"), asyncHandler(authController.me));
router.use(authenticate, authorize("admin"));
router.get("/overview", asyncHandler(adminController.overview));
router.get("/categories", asyncHandler(adminController.listCategories));
router.post("/categories", asyncHandler(adminController.createCategory));
router.get("/professionals", asyncHandler(adminController.listProfessionals));
router.post("/professionals", asyncHandler(adminController.createProfessional));
router.delete("/professionals/:id", asyncHandler(adminController.deleteProfessional));
router.patch("/professionals/:id/status", asyncHandler(adminController.updateProfessionalStatus));
router.patch(
  "/professionals/:id/documents/:documentId",
  asyncHandler(adminController.updateDocumentStatus)
);
router.get(
  "/professionals/:id/documents/:documentId/file",
  asyncHandler(adminController.sendDocument)
);
router.get("/users", asyncHandler(adminController.listUsers));
router.patch("/users/:id/status", asyncHandler(adminController.updateUserStatus));

module.exports = router;
