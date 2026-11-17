const workerGrid = document.querySelector("#worker-grid");
const resultsCount = document.querySelector("#results-count");
const searchInput = document.querySelector("#search-input");
const citySelect = document.querySelector("#city-select");
const bookingDialog = document.querySelector("#booking-dialog");
const bookingForm = document.querySelector("#booking-form");
const bookingMessage = document.querySelector("#booking-message");
let selectedCategory = "All services";
let searchTimer;

const avatarColors = ["#ba785e", "#6c8974", "#bc8e54", "#81779a", "#588a8a", "#aa6e78"];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function formatPrice(price) {
  return new Intl.NumberFormat("en-IN").format(price);
}

async function loadWorkers() {
  workerGrid.innerHTML = '<div class="loading-state">Finding good people near you<span>...</span></div>';
  const params = new URLSearchParams();
  if (selectedCategory !== "All services") params.set("category", selectedCategory);
  if (citySelect.value) params.set("city", citySelect.value);
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());

  try {
    const response = await fetch(`/api/workers?${params.toString()}`);
    if (!response.ok) throw new Error("Couldn't load professionals right now.");
    const { workers } = await response.json();
    resultsCount.textContent = `${workers.length} professional${workers.length === 1 ? "" : "s"}`;

    if (workers.length === 0) {
      workerGrid.innerHTML =
        '<div class="empty-state"><strong>No pros found just yet.</strong>Try another service or city.</div>';
      return;
    }

    workerGrid.innerHTML = workers.map((worker, index) => {
      const name = escapeHtml(worker.name);
      const profession = escapeHtml(worker.profession);
      const category = escapeHtml(worker.category);
      const city = escapeHtml(worker.city);
      const initial = escapeHtml(worker.name.trim().charAt(0).toUpperCase());
      const description = escapeHtml(worker.description || "A trusted local professional.");
      const color = avatarColors[index % avatarColors.length];
      return `
        <article class="worker-card">
          <div class="worker-portrait">
            <span class="worker-avatar" style="--avatar-bg:${color}" aria-hidden="true">${initial}</span>
            <span class="verified-badge">✓ VERIFIED</span>
          </div>
          <div class="worker-details">
            <div class="worker-title-row"><h3>${name}</h3><span class="rating">★ ${Number(worker.rating).toFixed(1)} (${Number(worker.reviewCount) || 0})</span></div>
            <p class="worker-profession">${profession} · ${category}</p>
            <div class="worker-meta"><span>${Number(worker.experience)} yrs experience · ${city}</span><span class="worker-price">₹${formatPrice(Number(worker.price))}<small> / hour</small></span></div>
            <button class="book-button" type="button" data-worker-id="${escapeHtml(worker._id)}" data-profession="${profession}" data-price="${Number(worker.price)}">Book this pro <span aria-hidden="true">→</span></button>
            <span class="sr-only">${description}</span>
          </div>
        </article>`;
    }).join("");
  } catch (error) {
    resultsCount.textContent = "";
    workerGrid.innerHTML = `<div class="empty-state"><strong>Couldn't load professionals.</strong>${escapeHtml(error.message)} Please check your connection and try again.</div>`;
  }
}

document.querySelector("#service-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  selectedCategory = button.dataset.category;
  document.querySelectorAll(".service-tile").forEach((tile) => {
    tile.classList.toggle("selected", tile === button);
  });
  loadWorkers();
});

document.querySelector("#search-button").addEventListener("click", loadWorkers);
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(loadWorkers, 250);
});
citySelect.addEventListener("change", loadWorkers);
document.querySelector("#clear-filters").addEventListener("click", () => {
  selectedCategory = "All services";
  searchInput.value = "";
  citySelect.value = "";
  document.querySelectorAll(".service-tile").forEach((tile) => {
    tile.classList.toggle("selected", tile.dataset.category === selectedCategory);
  });
  loadWorkers();
});

workerGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".book-button");
  if (!button) return;
  fetch("/api/auth/me")
    .then((response) => {
      if (!response.ok) {
        window.location.href = "/login?next=%2F";
        return false;
      }
      return response.json();
    })
    .then((result) => {
      if (!result || !result.user) return;
      if (result.user.role !== "customer") {
        window.location.href = `/${result.user.role}`;
        return;
      }
      openBookingDialog(button);
    })
    .catch(() => {
      window.location.href = "/login?next=%2F";
    });
});

function openBookingDialog(button) {
  bookingForm.reset();
  bookingMessage.textContent = "";
  bookingMessage.classList.remove("success");
  document.querySelector("#booking-worker-id").value = button.dataset.workerId;
  document.querySelector("#booking-profession").textContent = button.dataset.profession;
  const hourlyRate = Number(button.dataset.price);
  const durationField = bookingForm.elements.durationHours;
  const estimate = document.querySelector("#booking-estimate");
  document.querySelector("#booking-intro").textContent =
    `${button.dataset.profession} · ₹${formatPrice(hourlyRate)} per hour`;
  const updateEstimate = () => {
    estimate.textContent = `Estimated total: ₹${formatPrice(hourlyRate * Number(durationField.value))}`;
  };
  durationField.onchange = updateEstimate;
  updateEstimate();
  const minimumDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  bookingForm.elements.scheduledAt.min = minimumDate;
  bookingDialog.showModal();
}

document.querySelector(".dialog-close").addEventListener("click", () => bookingDialog.close());
bookingDialog.addEventListener("click", (event) => {
  if (event.target === bookingDialog) bookingDialog.close();
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  bookingMessage.textContent = "";
  const submitButton = bookingForm.querySelector(".submit-booking");
  submitButton.disabled = true;
  submitButton.textContent = "Sending request...";

  const data = Object.fromEntries(new FormData(bookingForm).entries());
  data.scheduledAt = new Date(data.scheduledAt).toISOString();
  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (response.status === 401) {
      window.location.href = "/login?next=%2F";
      return;
    }
    if (!response.ok) throw new Error(result.message || "Booking request failed.");
    bookingMessage.textContent = result.message;
    bookingMessage.classList.add("success");
    bookingForm.reset();
    window.setTimeout(() => bookingDialog.close(), 1800);
  } catch (error) {
    bookingMessage.textContent = error.message || "Couldn't send your request. Please try again.";
    bookingMessage.classList.remove("success");
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Request a booking <span>→</span>';
  }
});

loadWorkers();
