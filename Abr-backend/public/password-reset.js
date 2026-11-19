const token = window.location.hash.slice(1);
const requestForm = document.querySelector("#request-form");
const resetForm = document.querySelector("#reset-form");
const message = document.querySelector("#reset-message");
const requestAgain = document.querySelector("#request-again");

if (new URLSearchParams(window.location.search).get("portal") === "provider") {
  document.querySelector("#sign-in-link").href = "/provider";
}

if (token) {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  document.querySelector("#reset-title").textContent = "Choose a new password";
  document.querySelector("#reset-intro").textContent = "Use at least 8 characters.";
  resetForm.hidden = false;
  requestAgain.hidden = false;
} else {
  requestForm.hidden = false;
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.toggleAttribute("data-error", error);
}

async function submit(form, path, body) {
  const button = form.querySelector("button");
  button.disabled = true;
  showMessage("");
  try {
    const response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message);
    showMessage(result.message);
    return true;
  } catch (error) {
    showMessage(error.message || "Please try again.", true);
    return false;
  } finally {
    button.disabled = false;
  }
}

requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = new FormData(requestForm).get("email");
  await submit(requestForm, "forgot-password", { email });
});

resetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = new FormData(resetForm);
  const password = values.get("password");
  if (password !== values.get("confirmation")) {
    showMessage("The passwords must match.", true);
    return;
  }
  if (await submit(resetForm, "reset-password", { token, password })) {
    resetForm.reset();
    resetForm.hidden = true;
    requestAgain.hidden = true;
    document.querySelector("#reset-intro").hidden = true;
  }
});
