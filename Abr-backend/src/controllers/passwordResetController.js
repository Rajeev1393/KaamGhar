const { createHash, randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { emailPattern } = require("../middleware/validate");
const httpError = require("../utils/httpError");

const expiryMs = 15 * 60 * 1000;
const eligibleAccount = { active: true, role: { $in: ["customer", "worker"] } };
const resetFields = { passwordResetDigest: "", passwordResetExpiresAt: "" };
const digest = (token) => createHash("sha256").update(token).digest("hex");

function resetLink(token) {
  const origin = process.env.PASSWORD_RESET_ORIGIN ||
    (process.env.NODE_ENV !== "production" ? `http://localhost:${process.env.PORT || 3000}` : "");
  let url;
  try {
    url = new URL("/api/auth/password-reset", origin);
  } catch {
    throw httpError(503, "Password reset email is unavailable. Please try again later.");
  }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw httpError(503, "Password reset email is unavailable. Please try again later.");
  }
  url.hash = token;
  return url.href;
}

async function requestReset(req, res) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !emailPattern.test(email)) throw httpError(400, "Enter a valid email address.");

  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !sender || !emailPattern.test(sender)) {
    throw httpError(503, "Password reset email is unavailable. Please try again later.");
  }

  const token = randomBytes(32).toString("hex");
  const link = resetLink(token);
  const passwordResetDigest = digest(token);
  const now = Date.now();
  const user = await User.findOneAndUpdate(
    {
      ...eligibleAccount,
      email,
      $or: [
        { passwordResetExpiresAt: { $exists: false } },
        { passwordResetExpiresAt: { $lte: new Date(now + expiryMs - 60_000) } }
      ]
    },
    { $set: { passwordResetDigest, passwordResetExpiresAt: new Date(now + expiryMs) } },
    { projection: { _id: 1 } }
  );

  if (user) {
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json" },
        signal: AbortSignal.timeout(8_000),
        body: JSON.stringify({
          sender: { email: sender, name: "KaamGhar" },
          to: [{ email }],
          subject: "Reset your KaamGhar password",
          textContent: `Open this link within 15 minutes to reset your password:\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
          headers: { "X-Mailin-track-clicks": "0" }
        })
      });
      if (!response.ok) throw new Error(`Brevo rejected the request (${response.status}).`);
    } catch (error) {
      await User.updateOne({ _id: user._id, passwordResetDigest }, { $unset: resetFields });
      console.error("Could not send a password reset email:", error.message);
    }
  }
  res.json({ message: "If an eligible account exists, you'll receive a password reset link." });
}

async function resetPassword(req, res) {
  const { token, password } = req.body || {};
  const invalidLink = "This reset link is invalid or has expired. Request a new link.";
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw httpError(400, invalidLink);
  if (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw httpError(400, "Use a password of at least 8 characters and no more than 72 bytes.");
  }

  const filter = { ...eligibleAccount, passwordResetDigest: digest(token) };
  if (!(await User.exists({ ...filter, passwordResetExpiresAt: { $gt: new Date() } }))) {
    throw httpError(400, invalidLink);
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await User.updateOne(
    { ...filter, passwordResetExpiresAt: { $gt: new Date() } },
    { $set: { password: passwordHash }, $unset: resetFields, $inc: { sessionVersion: 1 } }
  );
  if (!result.modifiedCount) throw httpError(400, invalidLink);
  res.json({ message: "Password updated. You can now sign in with your new password." });
}

module.exports = { requestReset, resetPassword };
