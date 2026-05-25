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

const API_BASE = (() => {
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "";
  // mail.X.Y → api.X.Y
  const parts = h.split(".");
  if (parts[0] === "mail") parts[0] = "api";
  return `https://${parts.join(".")}`;
})();

const HISTORY_KEY = "tempmail_history";

// ─── State ───
let currentEmail = null;
let refreshInterval = null;
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
const toastEl = $("#toast");

// ─── Toast ───
function showToast(msg, type = "") {
  toastEl.textContent = msg;
  toastEl.className = "toast show" + (type ? ` ${type}` : "");
  setTimeout(() => toastEl.classList.remove("show"), 2500);
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

function removeFromHistory(email) {
  let history = getHistory();
  history = history.filter(h => h.email !== email);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  if (history.length === 0) {
    historyList.innerHTML = "";
    return;
  }
  historyList.innerHTML = history.map(h => `
    <div class="history-item" data-email="${escapeHtml(h.email)}">
      <span class="history-email">${escapeHtml(h.email)}</span>
      <button class="history-delete" data-email="${escapeHtml(h.email)}" title="Remove">&times;</button>
    </div>
  `).join("");
  historyList.querySelectorAll(".history-item").forEach(item => {
    item.addEventListener("click", (e) => {
      if (e.target.classList.contains("history-delete")) return;
      restoreInput.value = item.dataset.email;
      restoreEmail();
    });
  });
  historyList.querySelectorAll(".history-delete").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeFromHistory(btn.dataset.email);
    });
  });
}

// ─── Helpers ───
function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatTimeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function getInitial(email) {
  if (!email) return "?";
  const name = email.split("@")[0];
  return name.charAt(0).toUpperCase();
}

function getAvatarColor(email) {
  const colors = [
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e", "#ef4444", "#f97316",
    "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
    "#3b82f6"
  ];
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── API ───
async function apiGenerate() {
  const res = await fetch(`${API_BASE}/api/generate`, { method: "POST" });
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
  const originalHTML = btnGenerate.innerHTML;
  btnGenerate.innerHTML = '<span class="loading"></span> Generating...';
  btnGenerate.disabled = true;
  try {
    const data = await apiGenerate();
    activateInbox(data.email);
    showToast(`Generated: ${data.username || data.email}`, "success");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    btnGenerate.innerHTML = originalHTML;
    btnGenerate.disabled = false;
  }
}

// ─── Restore ───
async function restoreEmail() {
  const email = restoreInput.value.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    showToast("Enter a valid email address", "error");
    return;
  }
  const originalHTML = btnRestore.innerHTML;
  btnRestore.innerHTML = '<span class="loading"></span>';
  btnRestore.disabled = true;
  try {
    const data = await apiRestore(email);
    activateInbox(data.email);
    showToast("Email restored!", "success");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btnRestore.innerHTML = originalHTML;
    btnRestore.disabled = false;
  }
}

// ─── Activate Inbox ───
function activateInbox(email) {
  currentEmail = email;
  addToHistory(email);
  seenIds.clear();
  inboxList.innerHTML = "";
  inboxList.appendChild(emptyState);
  emptyState.classList.remove("hidden");
  emptyState.querySelector(".empty-title").textContent = "Waiting for incoming emails...";
  emptyState.querySelector(".empty-hint").textContent = "Send an email to the address above";
  mailCount.textContent = "0 emails";
  emailAddress.textContent = currentEmail;
  generateSection.classList.add("hidden");
  inboxSection.classList.remove("hidden");
  startPolling();
  const url = new URL(window.location);
  url.searchParams.set("email", email);
  window.history.replaceState({}, "", url);
}

// ─── Back ───
function goBack() {
  stopPolling();
  currentEmail = null;
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
    const messages = data.messages || [];
    mailCount.textContent = `${messages.length} email${messages.length !== 1 ? "s" : ""}`;

    if (messages.length === 0) {
      emptyState.classList.remove("hidden");
      if (data.refreshed) {
        emptyState.querySelector(".empty-title").textContent = "Inbox refreshed — waiting for new emails...";
      } else if (data.notFound) {
        emptyState.querySelector(".empty-title").textContent = "Address not found";
        emptyState.querySelector(".empty-hint").textContent = "Generate a new email or restore one";
      }
      return;
    }

    // Remove expired cards and add new ones
    const currentIds = new Set(messages.map(m => m.id));
    inboxList.querySelectorAll('.email-card').forEach(card => {
      if (!currentIds.has(card.dataset.id)) {
        card.remove();
        seenIds.delete(card.dataset.id);
      }
    });
    for (const msg of messages) {
      if (!seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        addEmailCard(msg);
      }
    }
  } catch (err) {
    console.error("Inbox error:", err);
    showToast("Connection error — retrying...", "error");
  }
}

function addEmailCard(msg) {
  emptyState.classList.add("hidden");
  const card = document.createElement("div");
  card.className = "email-card unread";
  card.dataset.id = msg.id;
  
  const fromName = msg.from ? msg.from.split("@")[0] : "unknown";
  const avatarColor = getAvatarColor(msg.from || "");
  
  card.innerHTML = `
    <div class="email-avatar" style="background: linear-gradient(135deg, ${avatarColor}, ${avatarColor}dd)">
      ${getInitial(msg.from)}
    </div>
    <div class="email-info">
      <div class="email-from">${escapeHtml(fromName)}</div>
      <div class="email-subject">${escapeHtml(msg.subject)}</div>
      <div class="email-snippet">${escapeHtml(msg.snippet)}</div>
    </div>
    <span class="email-time">${formatTimeAgo(msg.timestamp)}</span>
  `;
  card.addEventListener("click", () => openEmail(msg.id));
  inboxList.insertBefore(card, inboxList.firstChild);
}

async function openEmail(messageId) {
  if (!currentEmail) return;
  // Loading state
  const card = inboxList.querySelector(`[data-id="${CSS.escape(messageId)}"]`);
  const prevCursor = card ? card.style.cursor : "";
  if (card) { card.style.cursor = "wait"; card.style.opacity = "0.6"; }
  try {
    const data = await apiReadMail(currentEmail, messageId);
    modalSubject.textContent = data.subject || "(no subject)";
    modalFrom.textContent = data.from || "unknown";
    modalTo.textContent = data.to || currentEmail;
    modalDate.textContent = new Date(data.timestamp).toLocaleString();
    // Revoke old blob without hiding modal
    revokeOldBlob();
    if (data.htmlBody) {
      const blob = new Blob([data.htmlBody], { type: "text/html; charset=utf-8" });
      const blobUrl = URL.createObjectURL(blob);
      modalBody.innerHTML = `<iframe sandbox="allow-same-origin allow-scripts" src="${blobUrl}" style="width:100%;min-height:200px;border:none;background:#fff;border-radius:8px;"></iframe>`;
    } else {
      modalBody.innerHTML = `<pre style="white-space:pre-wrap;font-family:inherit;padding:8px 0;">${escapeHtml(data.textBody || "(empty)")}</pre>`;
    }
    emailModal.classList.remove("hidden");
    // Mark as read
    if (card) card.classList.remove("unread");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  } finally {
    if (card) { card.style.cursor = prevCursor; card.style.opacity = ""; }
  }
}

function revokeOldBlob() {
  const iframe = modalBody.querySelector("iframe");
  if (iframe && iframe.src.startsWith("blob:")) {
    URL.revokeObjectURL(iframe.src);
  }
  modalBody.innerHTML = "";
}

function closeModal() {
  emailModal.classList.add("hidden");
  revokeOldBlob();
}

// ─── Copy Email ───
async function copyEmail() {
  if (!currentEmail) return;
  try {
    await navigator.clipboard.writeText(currentEmail);
    showToast("Copied!", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = currentEmail;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    showToast("Copied!", "success");
  }
}

// ─── Init ───
document.addEventListener("DOMContentLoaded", () => {
  btnGenerate.addEventListener("click", generateEmail);
  btnCopy.addEventListener("click", copyEmail);
  btnNew.addEventListener("click", () => { goBack(); generateEmail(); });
  btnBack.addEventListener("click", goBack);
  btnRestore.addEventListener("click", restoreEmail);
  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", closeModal);
  restoreInput.addEventListener("keydown", (e) => { if (e.key === "Enter") restoreEmail(); });
  
  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !emailModal.classList.contains("hidden")) {
      closeModal();
    }
  });
  
  renderHistory();

  // Auto-restore from URL param
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get("email");
  if (emailParam) {
    restoreInput.value = emailParam;
    restoreEmail();
  }
});