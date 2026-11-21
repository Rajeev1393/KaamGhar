const { Coupon } = require("../models/Commerce");
const httpError = require("./httpError");

function normalizeCode(value) {
  if (typeof value !== "string" || !/^[A-Z0-9-]{3,32}$/i.test(value.trim())) {
    throw httpError(400, "Enter a valid code with 3 to 32 letters, numbers or hyphens.");
  }
  return value.trim().toUpperCase();
}

async function bookingDiscount(input, amount, commission) {
  if (!input) return { discount: 0 };
  const code = normalizeCode(input);
  const coupon = await Coupon.findOne({
    code, active: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
  }).lean();
  if (!coupon) throw httpError(400, "This coupon is unavailable or has expired.");
  const requested = Math.round(coupon.kind === "percent" ? amount * coupon.value / 100 : coupon.value * 100);
  const discount = Math.min(requested, commission, amount - 100);
  if (discount <= 0) throw httpError(400, "This coupon does not apply to this booking.");
  return { discount, code };
}

module.exports = { normalizeCode, bookingDiscount };
