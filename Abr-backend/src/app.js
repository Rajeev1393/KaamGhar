const express = require("express");
const helmet = require("helmet");
const workerRoutes = require("./routes/workers");
const bookingRoutes = require("./routes/bookings");
const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const cookieParser = require("cookie-parser");
const sameOrigin = require("./middleware/sameOrigin");
const asyncHandler = require("./utils/asyncHandler");
const paymentsController = require("./controllers/paymentsController");

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"]
      }
    }
  })
);
app.use(cookieParser());
app.use(sameOrigin);
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  asyncHandler(paymentsController.webhook)
);
app.use(express.json({ limit: "10kb" }));
app.use(express.static(require("path").join(__dirname, "..", "public")));

app.use("/api/auth", authRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);

app.get(["/login", "/register"], (req, res) => {
  res.sendFile(require("path").join(__dirname, "..", "public", "login.html"));
});
app.get("/customer", (req, res) => {
  res.sendFile(require("path").join(__dirname, "..", "public", "customer.html"));
});
app.get("/worker", (req, res) => {
  res.sendFile(require("path").join(__dirname, "..", "public", "worker.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(require("path").join(__dirname, "..", "public", "admin.html"));
});

app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);
  const isClientError =
    error.status ||
    error.name === "ValidationError" ||
    error.name === "CastError" ||
    error.code === 11000;
  res.status(error.status || (error.code === 11000 ? 409 : isClientError ? 400 : 500)).json({
    message: isClientError
      ? error.code === 11000
        ? "An account with these details already exists."
        : error.message || "Please check your submitted details."
      : "Something went wrong. Please try again."
  });
});

module.exports = app;
