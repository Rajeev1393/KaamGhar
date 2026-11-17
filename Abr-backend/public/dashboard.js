const panel = document.body.dataset.panel;
const messageBox = document.querySelector("#dashboard-message");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date pending"
    : new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
}

function statusBadge(status) {
  return `<span class="status-badge status-${escapeHtml(status)}">${escapeHtml(status)}</span>`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.href = "/login";
    throw new Error("Please sign in again.");
  }
  if (!response.ok) throw new Error(result.message || "Request failed.");
  return result;
}

function notify(message, isError = false) {
  if (!messageBox) return;
  messageBox.textContent = message;
  messageBox.classList.toggle("error", isError);
  messageBox.classList.add("visible");
  window.setTimeout(() => messageBox.classList.remove("visible"), 3500);
}

function setUser(user) {
  document.querySelector("#user-name").textContent = user.name;
  document.querySelector("#user-avatar").textContent = user.name.trim().charAt(0).toUpperCase();
}

async function loadCustomerBookings() {
  const element = document.querySelector("#customer-bookings");
  const { bookings } = await api("/api/bookings");
  if (!bookings.length) {
    element.innerHTML = '<div class="empty-panel"><span>✳</span><strong>No bookings yet.</strong><p>Find a trusted local professional and your booking will show up here.</p><a href="/#professionals">Browse professionals →</a></div>';
    return;
  }
  element.innerHTML = `<table><thead><tr><th>Professional</th><th>Service date</th><th>Address</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${bookings.map((booking) => `
    <tr>
      <td><strong>${escapeHtml(booking.worker?.name || "Professional")}</strong><small>${escapeHtml(booking.worker?.profession || "Home service")}</small></td>
      <td>${formatDate(booking.scheduledAt)}</td>
      <td class="address-cell">${escapeHtml(booking.address)}</td>
      <td>${booking.totalAmount == null ? "—" : `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`}</td>
      <td>${statusBadge(booking.status)}</td>
      <td>${["pending", "confirmed"].includes(booking.status) ? `<button class="table-action danger" data-booking-action="cancelled" data-id="${escapeHtml(booking._id)}">Cancel</button>` : ""}</td>
    </tr>`).join("")}</tbody></table>`;
}

async function loadWorkerDashboard() {
  const [{ bookings }, { worker }] = await Promise.all([
    api("/api/bookings"),
    api("/api/workers/me")
  ]);
  const pending = bookings.filter((booking) => booking.status === "pending").length;
  const completed = bookings.filter((booking) => booking.status === "completed").length;
  document.querySelector("#worker-total").textContent = bookings.length;
  document.querySelector("#worker-pending").textContent = pending;
  document.querySelector("#worker-completed").textContent = completed;
  document.querySelector("#worker-status").textContent =
    worker.approvalStatus === "approved" ? (worker.available ? "Live" : "Paused") : worker.approvalStatus;

  const notice = document.querySelector("#approval-notice");
  if (worker.approvalStatus !== "approved") {
    notice.textContent = worker.approvalStatus === "rejected"
      ? "Your application needs an update. Please contact KaamGhar support before reapplying."
      : "Your profile is awaiting review. It will appear in marketplace search after admin approval.";
    notice.classList.remove("hidden");
  } else {
    notice.classList.add("hidden");
  }
  const form = document.querySelector("#worker-profile-form");
  for (const field of ["profession", "category", "city", "experience", "price", "description"]) {
    form.elements[field].value = worker[field] ?? "";
  }
  form.elements.available.checked = Boolean(worker.available);
  renderWorkerBookings(bookings);
}

function renderWorkerBookings(bookings) {
  const element = document.querySelector("#worker-bookings");
  if (!bookings.length) {
    element.innerHTML = '<div class="empty-panel"><span>▤</span><strong>No service requests yet.</strong><p>New customer bookings will appear here.</p></div>';
    return;
  }
  element.innerHTML = `<table><thead><tr><th>Customer</th><th>Service date</th><th>Address</th><th>Contact</th><th>Status</th><th>Action</th></tr></thead><tbody>${bookings.map((booking) => {
    let actions = "";
    if (booking.status === "pending") {
      actions = `<button class="table-action" data-booking-action="confirmed" data-id="${escapeHtml(booking._id)}">Accept</button> <button class="table-action danger" data-booking-action="cancelled" data-id="${escapeHtml(booking._id)}">Decline</button>`;
    } else if (booking.status === "confirmed") {
      actions = `<button class="table-action" data-booking-action="completed" data-id="${escapeHtml(booking._id)}">Complete</button> <button class="table-action danger" data-booking-action="cancelled" data-id="${escapeHtml(booking._id)}">Cancel</button>`;
    }
    return `<tr><td><strong>${escapeHtml(booking.customer?.name || booking.customerName)}</strong><small>${escapeHtml(booking.notes || "No extra notes")}</small></td><td>${formatDate(booking.scheduledAt)}</td><td class="address-cell">${escapeHtml(booking.address)}</td><td>${escapeHtml(booking.customer?.phone || booking.phone)}<small>${escapeHtml(booking.customer?.email || booking.email)}</small></td><td>${statusBadge(booking.status)}</td><td>${actions || "—"}</td></tr>`;
  }).join("")}</tbody></table>`;
}

async function loadAdminOverview() {
  const [{ stats, recentBookings }] = await Promise.all([
    api("/api/admin/overview")
  ]);
  document.querySelector("#admin-customers").textContent = stats.customers;
  document.querySelector("#admin-workers").textContent = stats.professionals;
  document.querySelector("#admin-pending").textContent = stats.pendingApprovals;
  document.querySelector("#admin-bookings").textContent = stats.bookings;
  document.querySelector("#admin-revenue").textContent =
    `₹${Number(stats.completedRevenue).toLocaleString("en-IN")}`;
  document.querySelector("#approval-count").textContent = stats.pendingApprovals || "";
  const recent = document.querySelector("#admin-recent");
  recent.innerHTML = recentBookings.length
    ? `<table><thead><tr><th>Customer</th><th>Professional</th><th>Service date</th><th>Status</th></tr></thead><tbody>${recentBookings.map((booking) => `<tr><td>${escapeHtml(booking.customer?.name || booking.customerName)}</td><td>${escapeHtml(booking.worker?.name || "Professional")}<small>${escapeHtml(booking.worker?.profession || "")}</small></td><td>${formatDate(booking.scheduledAt)}</td><td>${statusBadge(booking.status)}</td></tr>`).join("")}</tbody></table>`
    : '<div class="empty-panel">No bookings yet.</div>';
}

async function loadAdminProfessionals() {
  const status = document.querySelector("#professional-status").value;
  const { workers } = await api(`/api/admin/professionals?status=${encodeURIComponent(status)}`);
  const element = document.querySelector("#admin-professionals");
  if (!workers.length) {
    element.innerHTML = `<div class="empty-panel">No ${escapeHtml(status)} professional profiles.</div>`;
    return;
  }
  element.innerHTML = `<table><thead><tr><th>Professional</th><th>Service</th><th>Location</th><th>Price</th><th>Status</th><th>Review</th></tr></thead><tbody>${workers.map((worker) => {
    const user = worker.user || {};
    const actions = status === "pending"
      ? `<button class="table-action" data-professional-status="approved" data-id="${escapeHtml(worker._id)}">Approve</button> <button class="table-action danger" data-professional-status="rejected" data-id="${escapeHtml(worker._id)}">Reject</button>`
      : status === "approved"
        ? `<button class="table-action danger" data-professional-status="rejected" data-id="${escapeHtml(worker._id)}">Suspend</button>`
        : `<button class="table-action" data-professional-status="approved" data-id="${escapeHtml(worker._id)}">Approve</button>`;
    return `<tr><td><strong>${escapeHtml(worker.name)}</strong><small>${escapeHtml(user.email || "")} · ${escapeHtml(user.phone || "")}</small></td><td>${escapeHtml(worker.profession)}<small>${escapeHtml(worker.experience)} years experience</small></td><td>${escapeHtml(worker.city)}</td><td>₹${Number(worker.price).toLocaleString("en-IN")} / hour</td><td>${statusBadge(worker.approvalStatus)}</td><td>${actions}</td></tr>`;
  }).join("")}</tbody></table>`;
}

async function loadAdminBookings() {
  const { bookings } = await api("/api/bookings");
  const element = document.querySelector("#admin-bookings-table");
  element.innerHTML = bookings.length
    ? `<table><thead><tr><th>Customer</th><th>Professional</th><th>Service date</th><th>Address</th><th>Amount</th><th>Status</th></tr></thead><tbody>${bookings.map((booking) => `<tr><td><strong>${escapeHtml(booking.customer?.name || booking.customerName)}</strong><small>${escapeHtml(booking.customer?.phone || booking.phone)}</small></td><td>${escapeHtml(booking.worker?.name || "Professional")}<small>${escapeHtml(booking.worker?.profession || "")}</small></td><td>${formatDate(booking.scheduledAt)}</td><td class="address-cell">${escapeHtml(booking.address)}</td><td>${booking.totalAmount == null ? "—" : `₹${Number(booking.totalAmount).toLocaleString("en-IN")}`}</td><td>${statusBadge(booking.status)}</td></tr>`).join("")}</tbody></table>`
    : '<div class="empty-panel">No bookings yet.</div>';
}

async function loadPanelData() {
  if (panel === "customer") await loadCustomerBookings();
  if (panel === "worker") await loadWorkerDashboard();
  if (panel === "admin") await loadAdminOverview();
}

document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  } catch (error) {
    notify(error.message, true);
  }
});

document.querySelector("#refresh-button")?.addEventListener("click", () => {
  loadPanelData().catch((error) => notify(error.message, true));
});

document.addEventListener("click", async (event) => {
  const bookingAction = event.target.closest("[data-booking-action]");
  const professionalAction = event.target.closest("[data-professional-status]");
  try {
    if (bookingAction) {
      bookingAction.disabled = true;
      await api(`/api/bookings/${encodeURIComponent(bookingAction.dataset.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: bookingAction.dataset.bookingAction })
      });
      notify("Booking updated.");
      await loadPanelData();
    } else if (professionalAction) {
      professionalAction.disabled = true;
      await api(`/api/admin/professionals/${encodeURIComponent(professionalAction.dataset.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: professionalAction.dataset.professionalStatus })
      });
      notify("Professional profile updated.");
      await loadAdminProfessionals();
      await loadAdminOverview();
    }
  } catch (error) {
    notify(error.message, true);
    if (bookingAction) bookingAction.disabled = false;
    if (professionalAction) professionalAction.disabled = false;
  }
});

if (panel === "admin") {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const selected = tab.dataset.tab;
      if (!selected) return;
      document.querySelectorAll(".admin-view").forEach((view) => {
        view.classList.toggle("hidden", view.id !== `admin-view-${selected}`);
      });
      document.querySelectorAll(".admin-tab").forEach((item) => {
        item.classList.toggle("active", item.dataset.tab === selected);
      });
      if (selected === "professionals") loadAdminProfessionals().catch((error) => notify(error.message, true));
      if (selected === "bookings") loadAdminBookings().catch((error) => notify(error.message, true));
    });
  });
  document.querySelector("#professional-status").addEventListener("change", () => {
    loadAdminProfessionals().catch((error) => notify(error.message, true));
  });
}

if (panel === "worker") {
  document.querySelector("#worker-profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.querySelector("#profile-message");
    const body = Object.fromEntries(new FormData(form).entries());
    body.available = form.elements.available.checked;
    try {
      const result = await api("/api/workers/me", {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      message.textContent = "Profile saved.";
      message.classList.add("success");
      document.querySelector("#worker-status").textContent =
        result.worker.approvalStatus === "approved"
          ? (result.worker.available ? "Live" : "Paused")
          : result.worker.approvalStatus;
      notify("Profile saved.");
    } catch (error) {
      message.textContent = error.message;
      message.classList.remove("success");
    }
  });
}

api("/api/auth/me")
  .then(({ user }) => {
    if (user.role !== panel) {
      window.location.replace(`/${user.role}`);
      return;
    }
    setUser(user);
    return loadPanelData();
  })
  .catch((error) => {
    if (error.message !== "Please sign in again.") notify(error.message, true);
  });
