// TempMail Frontend — Vanilla JS

// ─── Theme Toggle ───
const THEME_KEY = "tempmail_theme";
const themeToggle = document.getElementById("theme-toggle");
const htmlEl = document.documentElement;

function getPreferredTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  htmlEl.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

applyTheme(getPreferredTheme());

themeToggle.addEventListener("click", () => {
  const current = htmlEl.getAttribute("data-theme");
  applyTheme(current === "dark" ? "light" : "dark");
});

const API_BASE = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
  ? ""
  : "https://tempmail.hafidh26.workers.dev";

const EMAIL_TTL = 1800;
const HISTORY_KEY = "tempmail_history";

// ─── State ───
let currentEmail = null;
let expiresIn = 0;
let refreshInterval = null;
let timerInterval = null;
let seenIds = new Set();

// ─── DOM ───
const $ = (sel) => document.querySelector(sel);
const generateSection = $("#generate-section");
const inboxSection = $("#inbox-section");
const btnGenerate = $("#btn-generate");
const btnCopy = $("#btn-copy");
const btnNew = $("#btn-new");
const btnBack = $("#btn-back");
const btnRestore = $("#btn-restore");
const restoreInput = $("#restore-input");
const historyList = $("#history-list");
const emailAddress = $("#email-address");
const timerProgress = $("#timer-progress");
const timerText = $("#timer-text");
const mailCount = $("#mail-count");
const inboxList = $("#inbox-list");
const emptyState = $("#empty-state");
const emailModal = $("#email-modal");
const modalOverlay = $("#modal-overlay");
const modalClose = $("#modal-close");
const modalSubject = $("#modal-subject");
const modalFrom = $("#modal-from");
const modalTo = $("#modal-to");
const modalDate = $("#modal-date");
const modalBody = $("#modal-body");

// ─── Toast ───
function showToast(msg) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

// ─── History ───
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function addToHistory(email) {
  let history = getHistory();
  history = history.filter(h => h.email !== email);
  history.unshift({ email, usedAt: Date.now() });
  history = history.slice(0, 10);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  if (history.length === 0) {
    historyList.innerHTML = "";
    return;
  }
  historyList.innerHTML = `
    <div class="history-label">Recent emails:</div>
    ${history.map(h => `<button class="history-chip" data-email="${escapeHtml(h.email)}">${escapeHtml(h.email)}</button>`).join("")}
  `;
  historyList.querySelectorAll(".history-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      restoreInput.value = chip.dataset.email;
      restoreEmail();
    });
  });
}

// ─── API ───
async function apiGenerate() {
  const res = await fetch(`${API_BASE}/api/generate`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to generate");
  return data;
}

async function apiRestore(email) {
  const res = await fetch(`${API_BASE}/api/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to restore");
  return data;
}

async function apiInbox(email) {
  const res = await fetch(`${API_BASE}/api/inbox/${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error("Failed to fetch inbox");
  return res.json();
}

async function apiReadMail(email, messageId) {
  const res = await fetch(`${API_BASE}/api/mail/${encodeURIComponent(email)}/${encodeURIComponent(messageId)}`);
  if (!res.ok) throw new Error("Failed to read email");
  return res.json();
}

// ─── Generate ───
async function generateEmail() {
  btnGenerate.innerHTML = '<span class="spinner"></span> Generating...';
  btnGenerate.disabled = true;
  try {
    const data = await apiGenerate();
    activateInbox(data.email, data.expiresIn);
    showToast(`Generated: ${data.username || data.email}`);
  } catch (err) {
    showToast("Error: " + err.message);
  } finally {
    btnGenerate.innerHTML = '<span class="btn-icon">⚡</span> Generate New Email';
    btnGenerate.disabled = false;
  }
}

// ─── Restore ───
async function restoreEmail() {
  const email = restoreInput.value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showToast("Enter a valid email address");
    return;
  }
  btnRestore.innerHTML = '<span class="spinner"></span>';
  btnRestore.disabled = true;
  try {
    const data = await apiRestore(email);
    activateInbox(data.email, data.expiresIn);
    showToast("Email restored!");
  } catch (err) {
    showToast(err.message);
  } finally {
    btnRestore.innerHTML = "🔄 Restore";
    btnRestore.disabled = false;
  }
}

// ─── Activate Inbox ───
function activateInbox(email, expiry) {
  currentEmail = email;
  expiresIn = expiry || EMAIL_TTL;
  addToHistory(email);
  seenIds.clear();
  inboxList.innerHTML = "";
  inboxList.appendChild(emptyState);
  emptyState.classList.remove("hidden");
  emptyState.querySelector("p").textContent = "Waiting for incoming emails...";
  emptyState.querySelector(".empty-hint").textContent = "Send an email to the address above";
  mailCount.textContent = "0 emails";
  emailAddress.textContent = currentEmail;
  generateSection.classList.add("hidden");
  inboxSection.classList.remove("hidden");
  startPolling();
  startTimer();
  const url = new URL(window.location);
  url.searchParams.set("email", email);
  window.history.replaceState({}, "", url);
}

// ─── Back ───
function goBack() {
  stopPolling();
  stopTimer();
  currentEmail = null;
  expiresIn = 0;
  seenIds.clear();
  inboxSection.classList.add("hidden");
  generateSection.classList.remove("hidden");
  const url = new URL(window.location);
  url.searchParams.delete("email");
  window.history.replaceState({}, "", url);
}

// ─── Polling ───
function startPolling() {
  stopPolling();
  fetchInbox();
  refreshInterval = setInterval(fetchInbox, 3000);
}

function stopPolling() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
}

async function fetchInbox() {
  if (!currentEmail) return;
  try {
    const data = await apiInbox(currentEmail);
    if (data.expiresIn > 0) expiresIn = data.expiresIn;

    const messages = data.messages || [];
    mailCount.textContent = `${messages.length} email${messages.length !== 1 ? "s" : ""}`;

    if (messages.length === 0) {
      emptyState.classList.remove("hidden");
      if (data.refreshed) {
        emptyState.querySelector("p").textContent = "Inbox refreshed — waiting for new emails...";
      } else if (data.notFound) {
        emptyState.querySelector("p").textContent = "Address not found";
        emptyState.querySelector(".empty-hint").textContent = "Generate a new email or restore one";
      }
      return;
    }

    emptyState.classList.add("hidden");
    for (const msg of messages) {
      if (!seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        addEmailCard(msg);
      }
    }
  } catch (err) {
    console.error("Inbox error:", err);
  }
}

function addEmailCard(msg) {
  emptyState.classList.add("hidden");
  const card = document.createElement("div");
  card.className = "email-card";
  card.dataset.id = msg.id;
  card.innerHTML = `
    <div class="email-card-top">
      <span class="email-card-from">${escapeHtml(msg.from)}</span>
      <span class="email-card-time">${formatTimeAgo(msg.timestamp)}</span>
    </div>
    <div class="email-card-subject">${escapeHtml(msg.subject)}</div>
    <div class="email-card-snippet">${escapeHtml(msg.snippet)}</div>
  `;
  card.addEventListener("click", () => openEmail(msg.id));
  inboxList.insertBefore(card, inboxList.firstChild);
}

async function openEmail(messageId) {
  if (!currentEmail) return;
  try {
    const data = await apiReadMail(currentEmail, messageId);
    modalSubject.textContent = data.subject || "(no subject)";
    modalFrom.textContent = data.from || "unknown";
    modalTo.textContent = data.to || currentEmail;
    modalDate.textContent = new Date(data.timestamp).toLocaleString();
    if (data.htmlBody) {
      modalBody.innerHTML = `<iframe sandbox="allow-same-origin" srcdoc="${escapeHtml(data.htmlBody)}"></iframe>`;
    } else {
      modalBody.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(data.textBody || "(empty)")}</pre>`;
    }
    emailModal.classList.remove("hidden");
  } catch (err) {
    showToast("Error: " + err.message);
  }
}

function closeModal() {
  emailModal.classList.add("hidden");
  modalBody.innerHTML = "";
}

async function copyEmail() {
  if (!currentEmail) return;
  try {
    await navigator.clipboard.writeText(currentEmail);
    showToast("Copied!");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = currentEmail;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Copied!");
  }
}

// ─── Timer ───
function startTimer() {
  stopTimer();
  updateTimer();
  timerInterval = setInterval(updateTimer, 1000);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateTimer() {
  if (expiresIn <= 0) {
    timerText.textContent = "Inbox expired — address still usable, restore for new 30min";
    timerProgress.style.width = "0%";
    timerProgress.style.background = "rgba(255,68,68,0.15)";
    stopPolling();
    stopTimer();
    return;
  }
  expiresIn--;
  const m = Math.floor(expiresIn / 60);
  const s = expiresIn % 60;
  timerText.textContent = `${m}:${s.toString().padStart(2, "0")} remaining`;
  const pct = (expiresIn / EMAIL_TTL) * 100;
  timerProgress.style.width = `${pct}%`;
  timerProgress.style.background = pct < 20 ? "rgba(255,68,68,0.15)" : pct < 50 ? "rgba(255,170,0,0.1)" : "var(--accent-dim)";
}

// ─── Helpers ───
function formatTimeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 10) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
}

function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// ─── Events ───
btnGenerate.addEventListener("click", generateEmail);
btnCopy.addEventListener("click", copyEmail);
btnNew.addEventListener("click", generateEmail);
btnBack.addEventListener("click", goBack);
btnRestore.addEventListener("click", restoreEmail);
restoreInput.addEventListener("keydown", e => { if (e.key === "Enter") restoreEmail(); });
modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ─── Init ───
renderHistory();
const params = new URLSearchParams(window.location.search);
if (params.get("email")) {
  activateInbox(params.get("email"), EMAIL_TTL);
}
