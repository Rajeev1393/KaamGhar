const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";

const app = require("../src/app");
const { validateRegister } = require("../src/middleware/validate");
const { signToken, verifyToken } = require("../src/utils/jwt");
const { create: createBooking } = require("../src/controllers/bookingsController");
const { listCategories } = require("../src/controllers/workersController");
const { authenticate, authorize } = require("../src/middleware/authenticate");
const { getServiceCategories, serviceCategories, setServiceCategories } = require("../src/config/serviceCategories");
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
    assert.deepEqual(categories, categoriesWithCustom.slice().sort((left, right) => left.name.localeCompare(right.name)));

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

test("booking controller rejects invalid inputs before any database query", async () => {
  await assert.rejects(
    createBooking({ body: {}, user: {} }, {}),
    (error) => error.status === 400 && /valid professional/.test(error.message)
  );
  await assert.rejects(
    createBooking({
      body: { workerId: "0123456789abcdef01234567", address: "12 Example Road", scheduledAt: "not-a-date", durationHours: 1 },
      user: {}
    }, {}),
    (error) => error.status === 400 && /future/.test(error.message)
  );
  await assert.rejects(
    createBooking({
      body: {
        workerId: "0123456789abcdef01234567",
        address: "12 Example Road",
        scheduledAt: "2099-01-15T10:30:00.000Z",
        durationHours: 13
      },
      user: {}
    }, {}),
    (error) => error.status === 400 && /1 and 12 hours/.test(error.message)
  );
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
