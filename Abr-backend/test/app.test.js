const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";

const app = require("../src/app");
const { validateRegister } = require("../src/middleware/validate");
const { signToken, verifyToken } = require("../src/utils/jwt");
const { changeStatus: changeBookingStatus } = require("../src/controllers/bookingsController");
const { parseBookingDetails } = require("../src/utils/bookingDetails");
const Booking = require("../src/models/Booking");
const BookingCheckout = require("../src/models/BookingCheckout");
const paymentsController = require("../src/controllers/paymentsController");
const { listCategories, getOwnEarnings } = require("../src/controllers/workersController");
const { authenticate, authorize } = require("../src/middleware/authenticate");
const { getServiceCategories, serviceCategories, setServiceCategories } = require("../src/config/serviceCategories");
const ServiceCategory = require("../src/models/ServiceCategory");
const { isValidFileSignature, getWorkerDocumentPath } = require("../src/utils/workerDocuments");
const adminController = require("../src/controllers/adminController");
const authController = require("../src/controllers/authController");
const User = require("../src/models/User");
const Worker = require("../src/models/Worker");

function runMiddleware(middleware, body) {
  return new Promise((resolve) => {
    const req = { body };
    middleware(req, {}, (error) => resolve({ error, body: req.body }));
  });
}

test("customer registration accepts valid account details", async () => {
  const result = await runMiddleware(validateRegister, {
    name: "Aanya Sharma",
    email: "AANYA@example.com",
    phone: "+91 98765 43210",
    password: "example-password",
    role: "customer"
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.email, "aanya@example.com");
});

test("professional registration validates its service listing", async () => {
  const result = await runMiddleware(validateRegister, {
    name: "Ramesh Kumar",
    email: "ramesh@example.com",
    phone: "9876543210",
    password: "example-password",
    role: "worker",
    profession: "Expert plumber",
    category: "Plumber",
    city: "Delhi",
    experience: "8",
    price: "299",
    description: "Experienced plumbing repairs and installations."
  });
  assert.equal(result.error, undefined);
  assert.equal(result.body.experience, 8);
  assert.equal(result.body.price, 299);
});

test("service categories come from the backend and reject unknown worker categories", async () => {
  const categoriesWithCustom = [...serviceCategories, { name: "Appliance Repair", label: "Appliance repair" }];
  setServiceCategories(categoriesWithCustom);
  try {
    let categories;
    await listCategories({}, { json(payload) { categories = payload.categories; } });
    assert.deepEqual(
      categories,
      categoriesWithCustom
        .map((category) => ({ ...category, price: category.price ?? 500 }))
        .sort((left, right) => left.name.localeCompare(right.name))
    );

    const customCategory = await runMiddleware(validateRegister, {
      name: "Ramesh Kumar",
      email: "ramesh@example.com",
      phone: "9876543210",
      password: "example-password",
      role: "worker",
      profession: "Appliance repair specialist",
      category: "appliance repair",
      city: "Delhi",
      experience: "8",
      price: "299",
      description: "Experienced appliance repairs and installations."
    });
    assert.equal(customCategory.error, undefined);
    assert.equal(customCategory.body.category, "Appliance Repair");

    const invalidCategory = await runMiddleware(validateRegister, {
      name: "Ramesh Kumar",
      email: "ramesh@example.com",
      phone: "9876543210",
      password: "example-password",
      role: "worker",
      profession: "Expert plumber",
      category: "Other",
      city: "Delhi",
      experience: "8",
      price: "299",
      description: "Experienced plumbing repairs and installations."
    });
    assert.equal(invalidCategory.error.status, 400);
  } finally {
    setServiceCategories(serviceCategories);
  }
  assert.deepEqual(getServiceCategories(), serviceCategories.slice().sort((left, right) => left.name.localeCompare(right.name)));
});

test("admin can edit category prices and delete unused categories", async () => {
  const originalFindOne = ServiceCategory.findOne;
  const originalWorkerExists = Worker.exists;
  const originalCategories = getServiceCategories();
  const category = {
    name: "Appliance Repair",
    label: "Appliance repair",
    price: 500,
    active: true,
    async save() { return this; }
  };
  let response;
  try {
    setServiceCategories([...originalCategories, category]);
    ServiceCategory.findOne = async () => category;
    Worker.exists = async () => null;
    await adminController.updateCategoryPrice(
      { params: { name: category.name }, body: { price: 750 } },
      { json(payload) { response = payload; } }
    );
    assert.equal(response.category.price, 750);
    assert.equal(getServiceCategories().find(({ name }) => name === category.name).price, 750);

    await adminController.deleteCategory(
      { params: { name: category.name } },
      { json(payload) { response = payload; } }
    );
    assert.equal(category.active, false);
    assert.equal(getServiceCategories().some(({ name }) => name === category.name), false);
    assert.equal(response.message, "Category deleted.");
  } finally {
    ServiceCategory.findOne = originalFindOne;
    Worker.exists = originalWorkerExists;
    setServiceCategories(originalCategories);
  }
});

test("category prices are validated and categories assigned to professionals cannot be deleted", async () => {
  const originalFindOne = ServiceCategory.findOne;
  const originalWorkerExists = Worker.exists;
  const category = { name: "Plumber", active: true };
  try {
    await assert.rejects(
      adminController.updateCategoryPrice(
        { params: { name: category.name }, body: { price: 0 } },
        {}
      ),
      (error) => error.status === 400
    );

    ServiceCategory.findOne = async () => category;
    Worker.exists = async () => ({ _id: new mongoose.Types.ObjectId() });
    await assert.rejects(
      adminController.deleteCategory({ params: { name: category.name } }, {}),
      (error) => error.status === 409
    );
    assert.equal(category.active, true);
  } finally {
    ServiceCategory.findOne = originalFindOne;
    Worker.exists = originalWorkerExists;
  }
});

test("registration rejects an invalid role and malformed email", async () => {
  const invalidRole = await runMiddleware(validateRegister, {
    name: "Aanya Sharma",
    email: "aanya@example.com",
    phone: "9876543210",
    password: "example-password",
    role: "admin"
  });
  assert.equal(invalidRole.error.status, 400);

  const invalidEmail = await runMiddleware(validateRegister, {
    name: "Aanya Sharma",
    email: "not-an-email",
    phone: "9876543210",
    password: "example-password"
  });
  assert.equal(invalidEmail.error.status, 400);
});

test("session token preserves user identity and role", () => {
  const token = signToken({ id: "0123456789abcdef01234567", role: "worker" });
  const payload = verifyToken(token);
  assert.equal(payload.sub, "0123456789abcdef01234567");
  assert.equal(payload.role, "worker");
});

test("admin and customer logins use independent session cookies", async () => {
  const accounts = {
    "admin@example.com": {
      id: "0123456789abcdef01234567",
      role: "admin",
      active: true,
      comparePassword: async (password) => password === "correct-password",
      toSafeObject() { return { role: this.role }; }
    },
    "customer@example.com": {
      id: "1123456789abcdef01234567",
      role: "customer",
      active: true,
      comparePassword: async (password) => password === "correct-password",
      toSafeObject() { return { role: this.role }; }
    }
  };
  const originalFindOne = User.findOne;
  const cookies = [];
  User.findOne = ({ email }) => ({
    select: async () => accounts[email] || null
  });
  const response = {
    cookie(name, token) {
      cookies.push({ name, token });
      return this;
    },
    json(payload) {
      return payload;
    }
  };

  try {
    await authController.adminLogin({ body: { email: "admin@example.com", password: "correct-password" } }, response);
    await authController.login({ body: { email: "customer@example.com", password: "correct-password" } }, response);
    await assert.rejects(
      authController.login({ body: { email: "admin@example.com", password: "correct-password" } }, response),
      (error) => error.status === 401
    );
  } finally {
    User.findOne = originalFindOne;
  }

  assert.deepEqual(cookies.map(({ name }) => name), ["kg_admin_session", "kg_session"]);
});

test("admin and customer API requests authenticate against their own cookies", async () => {
  const adminId = "0123456789abcdef01234567";
  const customerId = "1123456789abcdef01234567";
  const accounts = {
    [adminId]: { role: "admin", active: true },
    [customerId]: { role: "customer", active: true }
  };
  const originalFindById = User.findById;
  User.findById = async (id) => accounts[id.toString()] || null;

  async function authenticatedRole(originalUrl) {
    const req = {
      originalUrl,
      cookies: {
        kg_admin_session: signToken({ id: adminId, role: "admin" }),
        kg_session: signToken({ id: customerId, role: "customer" })
      }
    };
    const res = {
      status() { return this; },
      json() { return this; }
    };
    try {
      await new Promise((resolve, reject) => {
        authenticate(req, res, (error) => error ? reject(error) : resolve());
      });
      return req.user.role;
    } finally {
      User.findById = originalFindById;
    }
  }

  assert.equal(await authenticatedRole("/api/admin/overview"), "admin");
  User.findById = async (id) => accounts[id.toString()] || null;
  assert.equal(await authenticatedRole("/api/bookings"), "customer");
});

test("booking details reject invalid inputs before any database query", async () => {
  await assert.rejects(
    async () => parseBookingDetails({}),
    (error) => error.status === 400 && /valid professional/.test(error.message)
  );
  await assert.rejects(
    async () => parseBookingDetails({
      workerId: "0123456789abcdef01234567",
      address: "12 Example Road",
      scheduledAt: "not-a-date",
      durationHours: 1
    }),
    (error) => error.status === 400 && /future/.test(error.message)
  );
  await assert.rejects(
    async () => parseBookingDetails({
      workerId: "0123456789abcdef01234567",
      address: "12 Example Road",
      scheduledAt: "2099-01-15T10:30:00.000Z",
      durationHours: 13
    }),
    (error) => error.status === 400 && /1 and 12 hours/.test(error.message)
  );
});

test("payment signatures are verified using constant-time hex signatures", () => {
  const secret = "local-test-webhook-secret";
  const orderId = "order_test123";
  const paymentId = "pay_test456";
  const checkoutSignature = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const webhookBody = Buffer.from('{"event":"payment.captured"}');
  const webhookSignature = crypto.createHmac("sha256", secret).update(webhookBody).digest("hex");

  assert.equal(paymentsController.isValidCheckoutSignature(orderId, paymentId, checkoutSignature, secret), true);
  assert.equal(paymentsController.isValidCheckoutSignature(orderId, paymentId, `${checkoutSignature.slice(0, -1)}0`, secret), false);
  assert.equal(paymentsController.isValidWebhookSignature(webhookBody, webhookSignature, secret), true);
  assert.equal(paymentsController.isValidWebhookSignature(webhookBody, "not-a-signature", secret), false);
});

test("Razorpay authentication failures identify the backend configuration to check", async () => {
  const workerId = new mongoose.Types.ObjectId();
  const originalWorkerFindOne = Worker.findOne;
  const originalCheckoutFindOne = BookingCheckout.findOne;
  const originalFetch = global.fetch;
  const originalConsoleError = console.error;
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  process.env.RAZORPAY_KEY_ID = "rzp_test_example";
  process.env.RAZORPAY_KEY_SECRET = "local-test-key-secret";
  Worker.findOne = async () => ({ _id: workerId, price: 1000 });
  BookingCheckout.findOne = () => ({ sort: async () => null });
  global.fetch = async () => new Response(JSON.stringify({
    error: { code: "BAD_REQUEST_ERROR", description: "Authentication failed" }
  }), { status: 400, headers: { "Content-Type": "application/json" } });
  console.error = () => {};

  try {
    await assert.rejects(
      paymentsController.createBookingOrder({
        body: {
          workerId: workerId.toString(),
          address: "12 Example Road, Sector 10",
          scheduledAt: "2099-01-15T10:30:00.000Z",
          durationHours: 1
        },
        user: {
          _id: new mongoose.Types.ObjectId(),
          name: "Aanya Sharma",
          phone: "+91 98765 43210",
          email: "aanya@example.com"
        }
      }, {}),
      (error) => error.status === 502 && /authentication failed.*Abr-backend\/.env/i.test(error.message)
    );
  } finally {
    Worker.findOne = originalWorkerFindOne;
    BookingCheckout.findOne = originalCheckoutFindOne;
    global.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
  }
});

test("booking checkout creates a server-priced order without creating a booking", async () => {
  const customerId = new mongoose.Types.ObjectId();
  const workerId = new mongoose.Types.ObjectId("0123456789abcdef01234567");
  const originalWorkerFindOne = Worker.findOne;
  const originalCheckoutFindOne = BookingCheckout.findOne;
  const originalCheckoutSave = BookingCheckout.prototype.save;
  const originalBookingSave = Booking.prototype.save;
  const originalFetch = global.fetch;
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  let savedCheckout;
  let orderRequest;
  let responseStatus;
  let responseBody;
  let bookingSaveCount = 0;
  process.env.RAZORPAY_KEY_ID = "rzp_test_example";
  process.env.RAZORPAY_KEY_SECRET = "local-test-key-secret";
  Worker.findOne = async () => ({ _id: workerId, price: 1250, hourlyCommission: 75.25 });
  BookingCheckout.findOne = () => ({ sort: async () => null });
  BookingCheckout.prototype.save = async function save() {
    savedCheckout = this;
    return this;
  };
  Booking.prototype.save = async function save() {
    bookingSaveCount += 1;
    return this;
  };
  global.fetch = async (url, options) => {
    orderRequest = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      id: "order_checkout123",
      expire_by: orderRequest.body.expire_by
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  try {
    await paymentsController.createBookingOrder({
      body: {
        workerId: workerId.toString(),
        address: "12 Example Road, Sector 10",
        scheduledAt: "2099-01-15T10:30:00.000Z",
        durationHours: 2,
        notes: "Call first"
      },
      user: {
        _id: customerId,
        name: "Aanya Sharma",
        phone: "+91 98765 43210",
        email: "aanya@example.com"
      }
    }, {
      status(code) { responseStatus = code; return this; },
      json(body) { responseBody = body; return this; }
    });
  } finally {
    Worker.findOne = originalWorkerFindOne;
    BookingCheckout.findOne = originalCheckoutFindOne;
    BookingCheckout.prototype.save = originalCheckoutSave;
    Booking.prototype.save = originalBookingSave;
    global.fetch = originalFetch;
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
  }

  assert.equal(orderRequest.url, "https://api.razorpay.com/v1/orders");
  assert.equal(orderRequest.body.amount, 250000);
  assert.equal(orderRequest.body.currency, "INR");
  assert.equal(Object.hasOwn(orderRequest.body, "expire_by"), false);
  assert.ok(orderRequest.body.receipt.length <= 40);
  assert.equal(savedCheckout.totalAmount, 2500);
  assert.equal(savedCheckout.commissionAmount, 150.5);
  assert.equal(savedCheckout.paymentOrderId, "order_checkout123");
  assert.equal(bookingSaveCount, 0);
  assert.equal(responseStatus, 201);
  assert.equal(responseBody.orderId, "order_checkout123");
  assert.equal(responseBody.amount, 250000);
});

test("verified captured payment creates one paid booking from its checkout", async () => {
  const secret = "local-test-key-secret";
  const customerId = new mongoose.Types.ObjectId();
  const checkoutId = new mongoose.Types.ObjectId();
  const workerId = new mongoose.Types.ObjectId();
  const orderId = "order_checkout123";
  const paymentId = "pay_checkout456";
  const signature = crypto.createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const checkout = {
    _id: checkoutId,
    customer: customerId,
    worker: workerId,
    customerName: "Aanya Sharma",
    phone: "+91 98765 43210",
    email: "aanya@example.com",
    address: "12 Example Road, Sector 10",
    scheduledAt: new Date("2099-01-15T10:30:00.000Z"),
    durationHours: 2,
    notes: "Call first",
    totalAmount: 2500,
    paymentOrderId: orderId,
    expiresAt: new Date("2099-01-15T11:00:00.000Z"),
    status: "pending",
    async save() {}
  };
  const originalCheckoutFindOne = BookingCheckout.findOne;
  const originalCheckoutFindById = BookingCheckout.findById;
  const originalBookingFindById = Booking.findById;
  const originalBookingSave = Booking.prototype.save;
  const originalStartSession = mongoose.startSession;
  const originalFetch = global.fetch;
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  let bookingSaveCount = 0;
  let savedBooking;
  let responseBody;
  let webhookResponseBody;
  process.env.RAZORPAY_KEY_ID = "rzp_test_example";
  process.env.RAZORPAY_KEY_SECRET = secret;
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  BookingCheckout.findOne = async () => checkout;
  BookingCheckout.findById = () => ({ session: async () => checkout });
  Booking.prototype.save = async function save() {
    bookingSaveCount += 1;
    savedBooking = this;
    return this;
  };
  Booking.findById = () => ({
    populate() { return this; },
    lean: async () => savedBooking
  });
  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {}
  });
  global.fetch = async () => new Response(JSON.stringify({
    id: paymentId,
    order_id: orderId,
    amount: 250000,
    currency: "INR",
    status: "captured",
    created_at: 1795000000
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const request = {
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature
      },
      user: { _id: customerId }
    };
    const response = { json(body) { responseBody = body; return this; } };
    await paymentsController.verifyBookingPayment(request, response);
    await paymentsController.verifyBookingPayment(request, response);
    const webhookBody = Buffer.from(JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            status: "captured",
            amount: 250000,
            currency: "INR"
          }
        }
      }
    }));
    const webhookSignature = crypto.createHmac("sha256", secret).update(webhookBody).digest("hex");
    await paymentsController.webhook({
      body: webhookBody,
      get: (name) => name === "x-razorpay-signature" ? webhookSignature : undefined
    }, {
      json(body) { webhookResponseBody = body; return this; }
    });
  } finally {
    BookingCheckout.findOne = originalCheckoutFindOne;
    BookingCheckout.findById = originalCheckoutFindById;
    Booking.findById = originalBookingFindById;
    Booking.prototype.save = originalBookingSave;
    mongoose.startSession = originalStartSession;
    global.fetch = originalFetch;
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
    if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  }

  assert.equal(bookingSaveCount, 1);
  assert.equal(savedBooking.paymentStatus, "paid");
  assert.equal(savedBooking.paymentId, paymentId);
  assert.equal(checkout.status, "paid");
  assert.deepEqual(responseBody.booking, savedBooking);
  assert.deepEqual(webhookResponseBody, { received: true });
});

test("payment order amount is calculated from the confirmed booking on the server", async () => {
  const bookingId = new mongoose.Types.ObjectId("0123456789abcdef01234567");
  const customerId = new mongoose.Types.ObjectId("1123456789abcdef01234567");
  const booking = {
    _id: bookingId,
    customer: customerId,
    status: "confirmed",
    totalAmount: 1250,
    async save() {}
  };
  const originalFindOne = Booking.findOne;
  const originalFetch = global.fetch;
  const originalKeyId = process.env.RAZORPAY_KEY_ID;
  const originalKeySecret = process.env.RAZORPAY_KEY_SECRET;
  let orderRequest;
  let responseStatus;
  let responseBody;
  process.env.RAZORPAY_KEY_ID = "rzp_test_example";
  process.env.RAZORPAY_KEY_SECRET = "local-test-key-secret";
  Booking.findOne = async () => booking;
  global.fetch = async (url, options) => {
    orderRequest = { url, body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      id: "order_test123",
      expire_by: orderRequest.body.expire_by
    }), { status: 201, headers: { "Content-Type": "application/json" } });
  };

  try {
    await paymentsController.createOrder(
      { params: { id: bookingId.toString() }, user: { _id: customerId } },
      {
        status(code) { responseStatus = code; return this; },
        json(body) { responseBody = body; return this; }
      }
    );
  } finally {
    Booking.findOne = originalFindOne;
    global.fetch = originalFetch;
    if (originalKeyId === undefined) delete process.env.RAZORPAY_KEY_ID;
    else process.env.RAZORPAY_KEY_ID = originalKeyId;
    if (originalKeySecret === undefined) delete process.env.RAZORPAY_KEY_SECRET;
    else process.env.RAZORPAY_KEY_SECRET = originalKeySecret;
  }

  assert.equal(orderRequest.url, "https://api.razorpay.com/v1/orders");
  assert.equal(orderRequest.body.amount, 125000);
  assert.equal(orderRequest.body.currency, "INR");
  assert.equal(Object.hasOwn(orderRequest.body, "expire_by"), false);
  assert.equal(booking.paymentOrderId, "order_test123");
  assert.equal(responseStatus, 201);
  assert.equal(responseBody.orderId, "order_test123");
});

test("a signed captured-payment webhook records payment for the matching booking", async () => {
  const secret = "local-test-webhook-secret";
  const webhookBody = Buffer.from(JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test456",
          order_id: "order_test123",
          status: "captured",
          amount: 125000,
          currency: "INR",
          created_at: 1795000000
        }
      }
    }
  }));
  const signature = crypto.createHmac("sha256", secret).update(webhookBody).digest("hex");
  const booking = {
    status: "completed",
    paymentStatus: "unpaid",
    paymentOrderId: "order_test123",
    totalAmount: 1250,
    async save() {}
  };
  const originalFindOne = Booking.findOne;
  const originalCheckoutFindOne = BookingCheckout.findOne;
  const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  let responseBody;
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  BookingCheckout.findOne = async () => null;
  Booking.findOne = async () => booking;

  try {
    await paymentsController.webhook(
      {
        body: webhookBody,
        get: (name) => name === "x-razorpay-signature" ? signature : undefined
      },
      { json(body) { responseBody = body; return this; } }
    );
  } finally {
    Booking.findOne = originalFindOne;
    BookingCheckout.findOne = originalCheckoutFindOne;
    if (originalWebhookSecret === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
  }

  assert.equal(booking.paymentStatus, "paid");
  assert.equal(booking.paymentId, "pay_test456");
  assert.deepEqual(responseBody, { received: true });
});

test("admin overview reports received payments and includes Razorpay order ids", async () => {
  const originals = {
    userCount: User.countDocuments,
    workerCount: Worker.countDocuments,
    workerAggregate: Worker.aggregate,
    bookingCount: Booking.countDocuments,
    bookingAggregate: Booking.aggregate,
    bookingFind: Booking.find
  };
  const recentBookings = [{ _id: "booking1", paymentOrderId: "order_test123", paymentStatus: "paid" }];
  let responseBody;
  User.countDocuments = async () => 7;
  Worker.countDocuments = async ({ approvalStatus }) => approvalStatus === "approved" ? 5 : 2;
  Worker.aggregate = async () => [{ total: 3 }];
  Booking.countDocuments = async () => 9;
  Booking.aggregate = async (pipeline) => pipeline[0].$match.status === "completed"
    ? [{ total: 12000 }]
    : [{ total: 5500, count: 4, commission: 350.75, providerAmount: 5149.25 }];
  Booking.find = () => ({
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => recentBookings
  });

  try {
    await adminController.overview({}, { json(body) { responseBody = body; return this; } });
  } finally {
    User.countDocuments = originals.userCount;
    Worker.countDocuments = originals.workerCount;
    Worker.aggregate = originals.workerAggregate;
    Booking.countDocuments = originals.bookingCount;
    Booking.aggregate = originals.bookingAggregate;
    Booking.find = originals.bookingFind;
  }

  assert.equal(responseBody.stats.paymentsReceived, 5500);
  assert.equal(responseBody.stats.paymentsReceivedCount, 4);
  assert.equal(responseBody.stats.commissionReceived, 350.75);
  assert.equal(responseBody.stats.providerAmountReceived, 5149.25);
  assert.equal(responseBody.recentBookings[0].paymentOrderId, "order_test123");
});

test("admin booking list returns payment order details for all bookings", async () => {
  const originalFind = Booking.find;
  const bookings = [{ _id: "booking1", paymentOrderId: "order_test123", paymentStatus: "paid" }];
  let responseBody;
  Booking.find = () => ({
    populate() { return this; },
    sort() { return this; },
    limit(value) { assert.equal(value, 500); return this; },
    lean: async () => bookings
  });

  try {
    await adminController.listBookings({}, { json(body) { responseBody = body; return this; } });
  } finally {
    Booking.find = originalFind;
  }

  assert.equal(responseBody.bookings[0].paymentOrderId, "order_test123");
  assert.equal(responseBody.bookings[0].paymentStatus, "paid");
});

test("provider earnings summarize paid bookings by payout status", async () => {
  const originalAggregate = Booking.aggregate;
  const workerId = new mongoose.Types.ObjectId();
  let pipeline;
  let responseBody;
  Booking.aggregate = async (value) => {
    pipeline = value;
    return [{ total: 12000, pending: 7000, cleared: 5000 }];
  };

  try {
    await getOwnEarnings(
      { user: { worker: workerId } },
      { json(body) { responseBody = body; return this; } }
    );
  } finally {
    Booking.aggregate = originalAggregate;
  }

  assert.equal(pipeline[0].$match.paymentStatus, "paid");
  assert.equal(pipeline[0].$match.worker.toString(), workerId.toString());
  assert.deepEqual(responseBody.earnings, { total: 12000, pending: 7000, cleared: 5000 });
});

test("admin professional list includes pending and cleared payout totals", async () => {
  const workerId = new mongoose.Types.ObjectId();
  const originals = { workerFind: Worker.find, bookingAggregate: Booking.aggregate };
  let responseBody;
  Worker.find = () => ({
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{ _id: workerId, name: "Ramesh Kumar" }]
  });
  Booking.aggregate = async () => [{ _id: workerId, total: 12000, pending: 7000, cleared: 5000 }];

  try {
    await adminController.listProfessionals(
      { query: { status: "approved" } },
      { json(body) { responseBody = body; return this; } }
    );
  } finally {
    Worker.find = originals.workerFind;
    Booking.aggregate = originals.bookingAggregate;
  }

  assert.deepEqual(responseBody.workers[0].earnings, { total: 12000, pending: 7000, cleared: 5000 });
});

test("admin provider accounts include payout totals for the Users list", async () => {
  const userId = new mongoose.Types.ObjectId();
  const workerId = new mongoose.Types.ObjectId();
  const originals = { workerFind: Worker.find, userFind: User.find, bookingAggregate: Booking.aggregate };
  let responseBody;
  Worker.find = () => ({ distinct: async () => [userId] });
  User.find = () => ({
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    limit() { return this; },
    lean: async () => [{
      _id: userId,
      role: "worker",
      name: "Ramesh Kumar",
      worker: { _id: workerId, profession: "Plumber" }
    }]
  });
  Booking.aggregate = async () => [{ _id: workerId, total: 12000, pending: 7000, cleared: 5000 }];

  try {
    await adminController.listUsers(
      { query: { role: "worker" } },
      { json(body) { responseBody = body; return this; } }
    );
  } finally {
    Worker.find = originals.workerFind;
    User.find = originals.userFind;
    Booking.aggregate = originals.bookingAggregate;
  }

  assert.deepEqual(responseBody.users[0].worker.earnings, { total: 12000, pending: 7000, cleared: 5000 });
});

test("admin can mark a provider's pending paid bookings as cleared", async () => {
  const workerId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const originals = {
    workerFindOne: Worker.findOne,
    bookingFind: Booking.find,
    bookingUpdateMany: Booking.updateMany,
    startSession: mongoose.startSession
  };
  const pendingBookings = [
    { _id: new mongoose.Types.ObjectId(), totalAmount: 2000, commissionAmount: 125.5 },
    { _id: new mongoose.Types.ObjectId(), totalAmount: 3500 }
  ];
  let responseBody;
  let update;
  Worker.findOne = () => ({ select: async () => ({ _id: workerId }) });
  Booking.find = () => ({
    select() { return this; },
    session() { return this; },
    lean: async () => pendingBookings
  });
  Booking.updateMany = async (_filter, updateValue) => {
    update = updateValue;
    return { modifiedCount: pendingBookings.length };
  };
  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {}
  });

  try {
    await adminController.clearProfessionalPayouts(
      {
        params: { id: workerId.toString() },
        body: { reference: "BANK-UTR-EXAMPLE" },
        user: { _id: adminId }
      },
      { json(body) { responseBody = body; return this; } }
    );
  } finally {
    Worker.findOne = originals.workerFindOne;
    Booking.find = originals.bookingFind;
    Booking.updateMany = originals.bookingUpdateMany;
    mongoose.startSession = originals.startSession;
  }

  assert.equal(update.$set.providerPayoutStatus, "cleared");
  assert.equal(update.$set.providerPayoutClearedBy.toString(), adminId.toString());
  assert.equal(update.$set.providerPayoutReference, "BANK-UTR-EXAMPLE");
  assert.equal(responseBody.payout.amount, 5374.5);
  assert.equal(responseBody.payout.bookingCount, 2);
});

test("a paid booking cannot be cancelled without a refund flow", async () => {
  const bookingId = "0123456789abcdef01234567";
  const customerId = new mongoose.Types.ObjectId();
  const originalFindById = Booking.findById;
  Booking.findById = async () => ({
    customer: { equals: (id) => id.toString() === customerId.toString() },
    worker: { equals: () => false },
    status: "confirmed",
    paymentStatus: "paid"
  });

  try {
    await assert.rejects(
      changeBookingStatus({
        params: { id: bookingId },
        body: { status: "cancelled" },
        user: { _id: customerId, role: "customer" }
      }, {}),
      (error) => error.status === 409 && /Contact support to request a refund/.test(error.message)
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

test("a provider can decline a paid booking and it is flagged for a refund", async () => {
  const bookingId = "0123456789abcdef01234567";
  const customerId = new mongoose.Types.ObjectId();
  const workerId = new mongoose.Types.ObjectId();
  const booking = {
    customer: { equals: (id) => id.toString() === customerId.toString() },
    worker: { equals: (id) => id.toString() === workerId.toString() },
    status: "pending",
    paymentStatus: "paid",
    async save() {}
  };
  const originalFindById = Booking.findById;
  Booking.findById = async () => booking;

  try {
    await changeBookingStatus({
      params: { id: bookingId },
      body: { status: "cancelled" },
      user: { _id: new mongoose.Types.ObjectId(), role: "worker", worker: workerId }
    }, { json() { return this; } });
  } finally {
    Booking.findById = originalFindById;
  }

  assert.equal(booking.status, "cancelled");
  assert.equal(booking.paymentStatus, "refund_required");
});

test("a provider cannot cancel a booking after its payout was cleared", async () => {
  const bookingId = "0123456789abcdef01234567";
  const workerId = new mongoose.Types.ObjectId();
  const originalFindById = Booking.findById;
  Booking.findById = async () => ({
    customer: { equals: () => false },
    worker: { equals: (id) => id.toString() === workerId.toString() },
    status: "confirmed",
    paymentStatus: "paid",
    providerPayoutStatus: "cleared"
  });

  try {
    await assert.rejects(
      changeBookingStatus({
        params: { id: bookingId },
        body: { status: "cancelled" },
        user: { _id: new mongoose.Types.ObjectId(), role: "worker", worker: workerId }
      }, { json() { return this; } }),
      (error) => error.status === 409 && error.message.includes("payout was cleared")
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

test("a booking cannot be cancelled while its payment checkout is active", async () => {
  const bookingId = "0123456789abcdef01234567";
  const customerId = new mongoose.Types.ObjectId();
  const originalFindById = Booking.findById;
  Booking.findById = async () => ({
    customer: { equals: (id) => id.toString() === customerId.toString() },
    worker: { equals: () => false },
    status: "confirmed",
    paymentStatus: "unpaid",
    paymentOrderId: "order_test123",
    paymentOrderExpiresAt: new Date(Date.now() + 60_000)
  });

  try {
    await assert.rejects(
      changeBookingStatus({
        params: { id: bookingId },
        body: { status: "cancelled" },
        user: { _id: customerId, role: "customer" }
      }, {}),
      (error) => error.status === 409 && /payment order has already been created/.test(error.message)
    );
  } finally {
    Booking.findById = originalFindById;
  }
});

test("verification documents require supported file signatures and safe storage names", () => {
  assert.equal(isValidFileSignature({ mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7") }), true);
  assert.equal(isValidFileSignature({ mimetype: "image/png", buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }), true);
  assert.equal(isValidFileSignature({ mimetype: "application/pdf", buffer: Buffer.from("<html>") }), false);
  assert.equal(getWorkerDocumentPath("../outside.pdf"), null);
});

test("admin document and account handlers reject malformed requests before database queries", async () => {
  await assert.rejects(
    adminController.createCategory({ body: { name: "x" } }, {}),
    (error) => error.status === 400
  );
  await assert.rejects(
    adminController.createProfessional({
      body: {
        name: "Sachin Sharma",
        email: "sachin@example.com",
        phone: "9876543210",
        password: "example-password",
        profession: "Home service professional",
        category: "Unknown",
        city: "Delhi",
        price: 250
      }
    }, {}),
    (error) => error.status === 400
  );
  await assert.rejects(
    adminController.updateDocumentStatus({ params: { id: "bad", documentId: "bad" }, body: { status: "verified" } }, {}),
    (error) => error.status === 400
  );
  await assert.rejects(
    adminController.deleteProfessional({ params: { id: "bad" } }, {}),
    (error) => error.status === 400
  );
  await assert.rejects(
    adminController.listUsers({ query: { role: "admin" } }, {}),
    (error) => error.status === 400
  );
});

test("deleting a professional removes their account and anonymizes the preserved booking profile", async () => {
  const id = "0123456789abcdef01234567";
  const userId = new mongoose.Types.ObjectId();
  const worker = {
    user: userId,
    name: "Sukpreet",
    city: "Chandigarh",
    available: true,
    description: "Professional profile",
    image: "profile-image",
    verificationDocuments: [],
    async save({ session }) {
      assert.ok(session);
    }
  };
  const originalStartSession = mongoose.startSession;
  const originalFindById = Worker.findById;
  const originalDeleteOne = User.deleteOne;
  let deletedUserFilter;
  let responseBody;

  mongoose.startSession = async () => ({
    withTransaction: async (operation) => operation(),
    endSession: async () => {}
  });
  Worker.findById = () => ({
    select() { return this; },
    session: async () => worker
  });
  User.deleteOne = (filter) => ({
    session: async () => {
      deletedUserFilter = filter;
      return { deletedCount: 1 };
    }
  });

  try {
    await adminController.deleteProfessional({ params: { id } }, {
      json(payload) {
        responseBody = payload;
        return this;
      }
    });
  } finally {
    mongoose.startSession = originalStartSession;
    Worker.findById = originalFindById;
    User.deleteOne = originalDeleteOne;
  }

  assert.equal(worker.name, "Deleted employee");
  assert.equal(worker.city, "Removed");
  assert.equal(worker.user, undefined);
  assert.ok(worker.deletedAt instanceof Date);
  assert.equal(worker.available, false);
  assert.equal(worker.verificationDocuments.length, 0);
  assert.equal(deletedUserFilter.role, "worker");
  assert.deepEqual(responseBody, { message: "Employee deleted; booking history preserved.", workerId: id });
});

test("role authorization denies users without the required role", async () => {
  let passedError;
  authorize("admin")({ user: { role: "customer" } }, {
    status(code) {
      assert.equal(code, 403);
      return this;
    },
    json(payload) {
      assert.match(payload.message, /permission/);
    }
  }, (error) => { passedError = error; });
  assert.equal(passedError, undefined);
});

test("admin can approve a professional without verification documents", async () => {
  const originalFindOne = Worker.findOne;
  const originalFindOneAndUpdate = Worker.findOneAndUpdate;
  let update;
  let responseBody;
  Worker.findOne = () => ({
    select: async () => ({ verificationDocuments: [] })
  });
  Worker.findOneAndUpdate = async (_filter, changes) => {
    update = changes;
    return { approvalStatus: "approved" };
  };

  try {
    await adminController.updateProfessionalStatus(
      { params: { id: "0123456789abcdef01234567" }, body: { status: "approved" } },
      { json(payload) { responseBody = payload; } }
    );
    assert.equal(update.$set.approvalStatus, "approved");
    assert.equal(update.$set.available, true);
    assert.equal(responseBody.worker.approvalStatus, "approved");
  } finally {
    Worker.findOne = originalFindOne;
    Worker.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("admin cannot approve until uploaded verification documents are verified", async () => {
  const originalFindOne = Worker.findOne;
  const originalFindOneAndUpdate = Worker.findOneAndUpdate;
  let updateCalled = false;
  Worker.findOne = () => ({
    select: async () => ({ verificationDocuments: [{ status: "pending" }] })
  });
  Worker.findOneAndUpdate = async () => {
    updateCalled = true;
  };

  try {
    await assert.rejects(
      adminController.updateProfessionalStatus(
        { params: { id: "0123456789abcdef01234567" }, body: { status: "approved" } },
        { json() {} }
      ),
      (error) => error.status === 409
    );
    assert.equal(updateCalled, false);
  } finally {
    Worker.findOne = originalFindOne;
    Worker.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("web panels are served and protected APIs reject anonymous requests", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  for (const [path, title] of [
    ["/", "Ghar ke kaam"],
    ["/login", "Sign in to KaamGhar"],
    ["/customer", "My bookings"],
    ["/worker", "Professional dashboard"],
    ["/admin", "Operations dashboard"]
  ]) {
    const response = await fetch(`${origin}${path}`);
    const html = await response.text();
    assert.equal(response.status, 200, `${path} should be served`);
    assert.match(html, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  const categoriesResponse = await fetch(`${origin}/api/workers/categories`);
  assert.equal(categoriesResponse.status, 200);
  assert.deepEqual(
    (await categoriesResponse.json()).categories,
    serviceCategories.slice().sort((left, right) => left.name.localeCompare(right.name))
  );

  for (const path of [
    "/api/auth/me",
    "/api/bookings",
    "/api/admin/overview",
    "/api/admin/categories",
    "/api/admin/professionals",
    "/api/admin/users",
    "/api/admin/professionals/0123456789abcdef01234567/documents/0123456789abcdef01234567/file"
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 401, `${path} should require a session`);
  }
  const professionalDeletion = await fetch(`${origin}/api/admin/professionals/0123456789abcdef01234567`, { method: "DELETE" });
  assert.equal(professionalDeletion.status, 401, "professional deletion should require an admin session");
  const professionalCreation = await fetch(`${origin}/api/admin/professionals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(professionalCreation.status, 401, "professional account creation should require an admin session");
  const documentUpload = await fetch(`${origin}/api/workers/me/documents`, { method: "POST" });
  assert.equal(documentUpload.status, 401, "document upload should require a professional session");

  const crossOriginRequest = await fetch(`${origin}/api/auth/logout`, {
    method: "POST",
    headers: { Origin: "https://attacker.example" }
  });
  assert.equal(crossOriginRequest.status, 403);
});
