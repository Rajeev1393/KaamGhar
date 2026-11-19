const crypto = require("node:crypto");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const BookingCheckout = require("../models/BookingCheckout");
const Worker = require("../models/Worker");
const httpError = require("../utils/httpError");
const { parseBookingDetails } = require("../utils/bookingDetails");

function razorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw httpError(503, "Online payments are not configured.");
  }
  return { keyId, keySecret };
}

function safeEqualHex(expected, actual) {
  if (typeof actual !== "string" || !/^[a-f\d]{64}$/i.test(actual)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function isValidCheckoutSignature(orderId, paymentId, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

function isValidWebhookSignature(body, signature, secret) {
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return safeEqualHex(expected, signature);
}

function paymentAmount(checkout) {
  const amount = Math.round(checkout.totalAmount * 100);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw httpError(400, "This booking has an invalid payment amount.");
  }
  return amount;
}

async function finalizeBookingCheckout(checkoutId, payment) {
  const session = await mongoose.startSession();
  let bookingId;
  try {
    await session.withTransaction(async () => {
      bookingId = undefined;
      const checkout = await BookingCheckout.findById(checkoutId).session(session);
      if (!checkout) throw httpError(404, "Payment checkout not found.");
      if (
        typeof payment.id !== "string" ||
        payment.order_id !== checkout.paymentOrderId ||
        payment.amount !== paymentAmount(checkout) ||
        payment.currency !== "INR" ||
        payment.status !== "captured"
      ) {
        throw httpError(400, "Payment details do not match this booking.");
      }
      if (checkout.booking) {
        if (checkout.paymentId !== payment.id) {
          throw httpError(409, "This checkout has already been paid.");
        }
        bookingId = checkout.booking;
        return;
      }

      const booking = new Booking({
        customer: checkout.customer,
        worker: checkout.worker,
        customerName: checkout.customerName,
        phone: checkout.phone,
        email: checkout.email,
        address: checkout.address,
        scheduledAt: checkout.scheduledAt,
        durationHours: checkout.durationHours,
        notes: checkout.notes,
        totalAmount: checkout.totalAmount,
        commissionAmount: checkout.commissionAmount,
        paymentStatus: "paid",
        paymentOrderId: checkout.paymentOrderId,
        paymentId: payment.id,
        paidAt: new Date((payment.created_at || Math.floor(Date.now() / 1000)) * 1000)
      });
      await booking.save({ session });

      checkout.status = "paid";
      checkout.paymentId = payment.id;
      checkout.paidAt = booking.paidAt;
      checkout.booking = booking._id;
      await checkout.save({ session });
      bookingId = booking._id;
    });
  } finally {
    await session.endSession();
  }

  return Booking.findById(bookingId)
    .populate("customer", "name email phone")
    .populate("worker", "name profession category city price")
    .lean();
}

async function syncCapturedCheckout(checkout) {
  const orderId = encodeURIComponent(checkout.paymentOrderId);
  const order = await razorpayRequest(`/orders/${orderId}`);
  if (order.status !== "paid") return null;
  const payments = await razorpayRequest(`/orders/${orderId}/payments`);
  const amount = paymentAmount(checkout);
  const payment = Array.isArray(payments.items)
    ? payments.items.find((item) =>
      item.status === "captured" &&
      item.order_id === checkout.paymentOrderId &&
      item.amount === amount &&
      item.currency === "INR"
    )
    : undefined;
  if (!payment) {
    throw httpError(409, "Razorpay marked this order paid, but its captured payment could not be verified.");
  }
  return finalizeBookingCheckout(checkout._id, payment);
}

function sameCheckoutDetails(checkout, worker, details, totalAmount) {
  return checkout.worker.toString() === worker._id.toString() &&
    checkout.address === details.address &&
    checkout.scheduledAt.getTime() === details.scheduledAt.getTime() &&
    checkout.durationHours === details.durationHours &&
    checkout.notes === details.notes &&
    checkout.totalAmount === totalAmount;
}

async function createBookingOrder(req, res) {
  const details = parseBookingDetails(req.body);
  const worker = await Worker.findOne({
    _id: details.workerId,
    available: true,
    approvalStatus: "approved",
    deletedAt: { $exists: false }
  }, "+hourlyCommission");
  if (!worker) throw httpError(404, "This professional is not available.");

  const totalAmount = worker.price * details.durationHours;
  const amount = Math.round(totalAmount * 100);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw httpError(400, "This professional has an invalid service price.");
  }

  const pendingCheckout = await BookingCheckout.findOne({
    customer: req.user._id,
    status: "pending"
  }).sort({ createdAt: -1 });

  if (pendingCheckout) {
    const paidBooking = await syncCapturedCheckout(pendingCheckout);
    if (paidBooking) {
      return res.json({ alreadyPaid: true, booking: paidBooking });
    }

    let pendingBooking;
    if (!sameCheckoutDetails(pendingCheckout, worker, details, totalAmount)) {
      const pendingWorker = pendingCheckout.worker.equals(worker._id)
        ? worker
        : await Worker.findById(pendingCheckout.worker).select("name profession");
      pendingBooking = {
        provider: pendingWorker?.name || "Previous professional",
        profession: pendingWorker?.profession || "Home service",
        address: pendingCheckout.address,
        scheduledAt: pendingCheckout.scheduledAt,
        durationHours: pendingCheckout.durationHours,
        notes: pendingCheckout.notes
      };
    }
    const { keyId } = razorpayCredentials();
    return res.json({
      keyId,
      orderId: pendingCheckout.paymentOrderId,
      amount: Math.round(pendingCheckout.totalAmount * 100),
      currency: "INR",
      pendingBooking
    });
  }

  const { keyId } = razorpayCredentials();
  const checkout = new BookingCheckout({
    customer: req.user._id,
    worker: worker._id,
    customerName: req.user.name,
    phone: req.user.phone,
    email: req.user.email,
    address: details.address,
    scheduledAt: details.scheduledAt,
    durationHours: details.durationHours,
    notes: details.notes,
    totalAmount,
    commissionAmount: Math.round(Math.min(worker.hourlyCommission ?? 0, worker.price) * details.durationHours * 100) / 100,
    paymentOrderId: "pending"
  });
  const order = await razorpayRequest("/orders", {
    method: "POST",
    body: {
      amount,
      currency: "INR",
      receipt: `${checkout._id.toString()}-${Date.now()}`,
      notes: { checkoutId: checkout._id.toString() }
    }
  });
  if (typeof order.id !== "string" || !order.id.startsWith("order_")) {
    throw httpError(502, "Razorpay did not return a valid payment order.");
  }

  checkout.paymentOrderId = order.id;
  try {
    await checkout.save();
  } catch (error) {
    if (error.code === 11000) {
      throw httpError(409, "You already have an unfinished payment checkout. Retry it with the same details.");
    }
    throw error;
  }

  res.status(201).json({
    keyId,
    orderId: order.id,
    amount,
    currency: "INR"
  });
}

async function verifyBookingPayment(req, res) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
    req.body || {};
  if (
    typeof orderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(orderId) ||
    typeof paymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(paymentId) ||
    typeof signature !== "string"
  ) {
    throw httpError(400, "Razorpay returned incomplete payment details.");
  }

  const checkout = await BookingCheckout.findOne({
    customer: req.user._id,
    paymentOrderId: orderId
  });
  if (!checkout) throw httpError(404, "Payment checkout does not belong to this customer.");

  const { keySecret } = razorpayCredentials();
  if (!isValidCheckoutSignature(orderId, paymentId, signature, keySecret)) {
    throw httpError(400, "Razorpay payment signature is invalid.");
  }
  const expectedAmount = paymentAmount(checkout);
  let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (
    payment.order_id !== orderId ||
    payment.amount !== expectedAmount ||
    payment.currency !== "INR"
  ) {
    throw httpError(400, "Payment details do not match this booking.");
  }
  if (payment.status === "authorized") {
    payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: "POST",
      body: { amount: expectedAmount, currency: "INR" }
    });
  }
  if (payment.status !== "captured") {
    throw httpError(409, "Payment has not been captured yet. Please refresh and try again.");
  }

  const booking = await finalizeBookingCheckout(checkout._id, payment);
  res.json({ message: "Payment verified and booking sent.", paymentStatus: "paid", booking });
}

async function razorpayRequest(path, { method = "GET", body } = {}) {
  const { keyId, keySecret } = razorpayCredentials();
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw httpError(502, "Could not connect to Razorpay. Please try again.");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw httpError(502, "Razorpay returned an invalid response.");
  }
  if (!response.ok) {
    const razorpayError = payload?.error && typeof payload.error === "object"
      ? payload.error
      : {};
    const code = typeof razorpayError.code === "string" ? razorpayError.code.slice(0, 80) : "";
    const description = typeof razorpayError.description === "string"
      ? razorpayError.description.replace(/[\r\n\t]+/g, " ").slice(0, 200)
      : "";
    console.error("Razorpay request rejected.", {
      status: response.status,
      code: code || undefined,
      description: description || undefined
    });
    if (response.status === 401 || response.status === 403 || /authentication failed/i.test(description)) {
      throw httpError(
        502,
        "Razorpay authentication failed. Check the test key ID and secret in Abr-backend/.env, then restart the backend."
      );
    }
    throw httpError(
      502,
      description
        ? `Razorpay rejected the request${code ? ` (${code})` : ""}: ${description}`
        : "Razorpay could not process the payment request."
    );
  }
  return payload;
}

async function createOrder(req, res) {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) {
    throw httpError(400, "Invalid booking id.");
  }
  const booking = await Booking.findOne({ _id: req.params.id, customer: req.user._id });
  if (!booking) throw httpError(404, "Booking not found.");
  if (!["confirmed", "completed"].includes(booking.status)) {
    throw httpError(409, "You can pay after the professional confirms your booking.");
  }
  if (booking.paymentStatus === "paid") {
    return res.json({ paymentStatus: "paid", alreadyPaid: true });
  }

  const { keyId } = razorpayCredentials();
  const amount = Math.round(booking.totalAmount * 100);
  if (!Number.isSafeInteger(amount) || amount < 1) {
    throw httpError(400, "This booking has an invalid payment amount.");
  }

  if (booking.paymentOrderId) {
    const currentOrder = await razorpayRequest(`/orders/${encodeURIComponent(booking.paymentOrderId)}`);
    if (currentOrder.status === "paid") {
      const currentPayments = await razorpayRequest(
        `/orders/${encodeURIComponent(booking.paymentOrderId)}/payments`
      );
      const capturedPayment = Array.isArray(currentPayments.items)
        ? currentPayments.items.find((payment) =>
          payment.status === "captured" &&
          payment.amount === amount &&
          payment.currency === "INR"
        )
        : undefined;
      if (!capturedPayment) {
        throw httpError(409, "Razorpay marked this order paid, but its captured payment could not be verified.");
      }
      booking.paymentStatus = "paid";
      booking.paymentId = capturedPayment.id;
      booking.paidAt = new Date((capturedPayment.created_at || Math.floor(Date.now() / 1000)) * 1000);
      await booking.save();
      return res.json({ paymentStatus: "paid", alreadyPaid: true });
    }
    return res.json({
      keyId,
      orderId: booking.paymentOrderId,
      amount,
      currency: "INR"
    });
  }

  const order = await razorpayRequest("/orders", {
    method: "POST",
    body: {
      amount,
      currency: "INR",
      receipt: `${booking._id.toString()}-${Date.now()}`,
      notes: { bookingId: booking._id.toString() }
    }
  });
  if (typeof order.id !== "string" || !order.id.startsWith("order_")) {
    throw httpError(502, "Razorpay did not return a valid payment order.");
  }

  booking.paymentStatus = "unpaid";
  booking.paymentOrderId = order.id;
  await booking.save();

  res.status(201).json({
    keyId,
    orderId: order.id,
    amount,
    currency: "INR"
  });
}

async function verifyPayment(req, res) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
    req.body || {};
  if (
    typeof orderId !== "string" ||
    !/^order_[a-zA-Z0-9]+$/.test(orderId) ||
    typeof paymentId !== "string" ||
    !/^pay_[a-zA-Z0-9]+$/.test(paymentId) ||
    typeof signature !== "string"
  ) {
    throw httpError(400, "Razorpay returned incomplete payment details.");
  }

  const booking = await Booking.findOne({
    _id: req.params.id,
    customer: req.user._id,
    paymentOrderId: orderId
  });
  if (!booking) throw httpError(404, "Payment order does not belong to this booking.");
  if (booking.paymentStatus === "paid") {
    if (booking.paymentId === paymentId) {
      return res.json({ message: "Payment already verified.", paymentStatus: "paid" });
    }
    throw httpError(409, "This booking has already been paid.");
  }
  if (!["confirmed", "completed"].includes(booking.status)) {
    throw httpError(409, "This booking is no longer available for payment.");
  }

  const { keySecret } = razorpayCredentials();
  if (!isValidCheckoutSignature(orderId, paymentId, signature, keySecret)) {
    throw httpError(400, "Razorpay payment signature is invalid.");
  }

  const expectedAmount = Math.round(booking.totalAmount * 100);
  let payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`);
  if (
    payment.order_id !== orderId ||
    payment.amount !== expectedAmount ||
    payment.currency !== "INR"
  ) {
    throw httpError(400, "Payment details do not match this booking.");
  }
  if (payment.status === "authorized") {
    payment = await razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: "POST",
      body: { amount: expectedAmount, currency: "INR" }
    });
  }
  if (payment.status !== "captured") {
    throw httpError(409, "Payment has not been captured yet. Please refresh and try again.");
  }

  const updatedBooking = await Booking.findOneAndUpdate(
    {
      _id: booking._id,
      customer: req.user._id,
      status: { $in: ["confirmed", "completed"] },
      paymentStatus: { $ne: "paid" },
      paymentOrderId: orderId
    },
    {
      $set: {
        paymentStatus: "paid",
        paymentId,
        paidAt: new Date()
      }
    },
    { new: true }
  );
  if (!updatedBooking) {
    const latestBooking = await Booking.findById(booking._id);
    if (latestBooking?.paymentStatus === "paid" && latestBooking.paymentId === paymentId) {
      return res.json({ message: "Payment already verified.", paymentStatus: "paid" });
    }
    throw httpError(409, "Booking changed while payment was processing. Contact support.");
  }

  res.json({ message: "Payment verified.", paymentStatus: "paid" });
}

async function webhook(req, res) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw httpError(503, "Razorpay webhook is not configured.");
  if (!Buffer.isBuffer(req.body)) {
    throw httpError(400, "Invalid webhook request body.");
  }
  if (!isValidWebhookSignature(req.body, req.get("x-razorpay-signature"), webhookSecret)) {
    throw httpError(400, "Razorpay webhook signature is invalid.");
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch {
    throw httpError(400, "Razorpay webhook payload is invalid.");
  }
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw httpError(400, "Razorpay webhook payload is invalid.");
  }
  if (event.event !== "payment.captured") {
    return res.json({ received: true });
  }

  const payment = event.payload?.payment?.entity;
  if (
    !payment ||
    typeof payment.order_id !== "string" ||
    typeof payment.id !== "string" ||
    payment.status !== "captured"
  ) {
    throw httpError(400, "Razorpay webhook is missing captured payment details.");
  }

  const checkout = await BookingCheckout.findOne({ paymentOrderId: payment.order_id });
  if (checkout) {
    if (
      payment.amount !== paymentAmount(checkout) ||
      payment.currency !== "INR"
    ) {
      throw httpError(400, "Razorpay webhook payment does not match the booking amount.");
    }
    await finalizeBookingCheckout(checkout._id, payment);
    return res.json({ received: true });
  }

  const booking = await Booking.findOne({ paymentOrderId: payment.order_id });
  if (
    booking &&
    (payment.amount !== Math.round(booking.totalAmount * 100) || payment.currency !== "INR")
  ) {
    throw httpError(400, "Razorpay webhook payment does not match the booking amount.");
  }
  if (booking && booking.paymentStatus !== "paid") {
    booking.paymentStatus = ["confirmed", "completed"].includes(booking.status) ? "paid" : "refund_required";
    booking.paymentId = payment.id;
    booking.paidAt = new Date((payment.created_at || Math.floor(Date.now() / 1000)) * 1000);
    await booking.save();
  }
  res.json({ received: true });
}

module.exports = {
  createBookingOrder,
  createOrder,
  isValidCheckoutSignature,
  isValidWebhookSignature,
  verifyBookingPayment,
  verifyPayment,
  webhook
};
