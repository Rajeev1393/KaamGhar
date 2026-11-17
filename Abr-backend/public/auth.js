const authForm = document.querySelector("#auth-form");
const authMessage = document.querySelector("#auth-message");
const roleSelect = document.querySelector("#account-role");
let mode = new URLSearchParams(window.location.search).has("role") ? "register" : "login";

function setMode(nextMode) {
  mode = nextMode;
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  document.querySelectorAll(".register-fields").forEach((fields) => {
    fields.classList.toggle("hidden", mode !== "register");
  });
  const isRegister = mode === "register";
  document.querySelector("#auth-mode-label").textContent = isRegister ? "JOIN THE NEIGHBOURHOOD" : "WELCOME BACK";
  document.querySelector("#auth-title").textContent = isRegister ? "Create your account" : "Sign in to KaamGhar";
  document.querySelector("#auth-subtitle").textContent = isRegister
    ? "One account for all your home services."
    : "Your home services, all in one place.";
  document.querySelector("#auth-submit-label").textContent = isRegister ? "Create account" : "Sign in";
  authForm.elements.password.autocomplete = isRegister ? "new-password" : "current-password";
  authMessage.textContent = "";
  updateWorkerFields();
}

function updateWorkerFields() {
  const isWorker = mode === "register" && roleSelect.value === "worker";
  document.querySelector("#worker-fields").classList.toggle("hidden", !isWorker);
  document.querySelectorAll("#worker-fields input, #worker-fields textarea").forEach((field) => {
    field.required = isWorker;
  });
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});
roleSelect.addEventListener("change", updateWorkerFields);

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authMessage.textContent = "";
  authMessage.classList.remove("success");
  const submit = authForm.querySelector("button[type=submit]");
  submit.disabled = true;
  document.querySelector("#auth-submit-label").textContent = "Please wait...";

  const body = Object.fromEntries(new FormData(authForm).entries());
  if (mode === "login") {
    delete body.name;
    delete body.phone;
    delete body.role;
  }
  try {
    const response = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "We couldn't complete that request.");
    authMessage.textContent = result.message;
    authMessage.classList.add("success");
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const next = requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : `/${result.user.role}`;
    window.setTimeout(() => {
      window.location.href = result.user.role === "admin" ? "/admin" : next;
    }, 350);
  } catch (error) {
    authMessage.textContent = error.message || "Could not connect. Please try again.";
  } finally {
    submit.disabled = false;
    document.querySelector("#auth-submit-label").textContent = mode === "register" ? "Create account" : "Sign in";
  }
});

setMode(mode);
if (mode === "register" && new URLSearchParams(window.location.search).get("role") === "worker") {
  roleSelect.value = "worker";
  updateWorkerFields();
}

fetch("/api/auth/me")
  .then((response) => response.ok ? response.json() : null)
  .then((result) => {
    if (result && result.user) window.location.href = `/${result.user.role}`;
  })
  .catch(() => {});
