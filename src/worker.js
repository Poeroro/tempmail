// ═══════════════════════════════════════════════════════════════════
// TempMail — Cloudflare Worker API + Email Inbound Handler
// ═══════════════════════════════════════════════════════════════════

import { USERNAME_POOL } from "./usernames.js";

// ─── Constants ────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const EMAIL_TTL = 1800;       // 30 min — individual email content expires
const ADDRESS_TTL = 31536000; // 1 year — address persists

// ─── Helpers ──────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// Decode MIME encoded headers (=?charset?encoding?data?=)
function decodeMimeHeader(str) {
  if (!str || !str.includes("=?")) return str;
  return str
    .replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_, charset, encoding, data) => {
      try {
        if (encoding.toUpperCase() === "B") {
          const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
          return new TextDecoder(charset).decode(bytes);
        }
        // Quoted-Printable
        const decoded = data.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        );
        const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        return new TextDecoder(charset).decode(bytes);
      } catch {
        return data;
      }
    })
    .replace(/\r?\n\s+/g, " "); // unfold continuation lines
}

// Extract body from a MIME part (handles both \r\n and \n line breaks)
function extractBody(part) {
  const idx = part.indexOf("\n\n");
  if (idx !== -1) return part.substring(idx + 2).trim();
  const idx2 = part.indexOf("\r\n\r\n");
  if (idx2 !== -1) return part.substring(idx2 + 4).trim();
  return "";
}

// ─── API Router ───────────────────────────────────────────────────

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // /api/generate — create new temp email
    if (path === "/api/generate") return await handleGenerate(env);
    // /api/restore — restore existing email
    if (path === "/api/restore") return await handleRestore(request, env);
    // /api/check?email=... — check if address exists
    if (path === "/api/check") {
      return await handleCheck(url.searchParams.get("email"), env);
    }

    // /api/inbox/{email} — list inbox
    const inboxMatch = path.match(/^\/api\/inbox\/(.+)$/);
    if (inboxMatch) {
      return await handleInbox(decodeURIComponent(inboxMatch[1]), env);
    }

    // /api/mail/{email}/{messageId} — read single email
    const mailMatch = path.match(/^\/api\/mail\/([^/]+)\/(.+)$/);
    if (mailMatch) {
      const email = decodeURIComponent(mailMatch[1]);
      const messageId = decodeURIComponent(mailMatch[2]);
      return await handleReadMail(email, messageId, env);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: err.message || "Internal error" }, 500);
  }
}

// ─── Generate Email ───────────────────────────────────────────────

async function handleGenerate(env) {
  const domain = env.DOMAIN || "example.com";

  for (let attempt = 0; attempt < 30; attempt++) {
    const idx = Math.floor(Math.random() * USERNAME_POOL.length);
    const username = USERNAME_POOL[idx];
    const email = `${username}@${domain}`;

    const existing = await env.MAIL_STORAGE.get(`addr:${email}`);
    if (existing) continue;

    await env.MAIL_STORAGE.put(
      `addr:${email}`,
      JSON.stringify({ email, username, created: Date.now() }),
      { expirationTtl: ADDRESS_TTL }
    );

    await env.MAIL_STORAGE.put(`inbox:${email}`, JSON.stringify([]), {
      expirationTtl: ADDRESS_TTL,
    });

    return json({ email, username, expiresIn: EMAIL_TTL });
  }

  return json({ error: "No available usernames. Try again." }, 503);
}

// ─── Restore Email ────────────────────────────────────────────────

async function handleRestore(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return json({ error: "Invalid email address" }, 400);
  }

  const addrRaw = await env.MAIL_STORAGE.get(`addr:${email}`);
  if (!addrRaw) {
    return json({ error: "Email not found. This address was never generated." }, 404);
  }

  // Refresh inbox + address TTL (preserve existing messages)
  const inboxRaw = await env.MAIL_STORAGE.get(`inbox:${email}`);
  await env.MAIL_STORAGE.put(
    `inbox:${email}`,
    inboxRaw || JSON.stringify([]),
    { expirationTtl: ADDRESS_TTL }
  );

  const addr = JSON.parse(addrRaw);
  await env.MAIL_STORAGE.put(
    `addr:${email}`,
    JSON.stringify({ ...addr, restored: Date.now() }),
    { expirationTtl: ADDRESS_TTL }
  );

  return json({ email, expiresIn: EMAIL_TTL });
}

// ─── Check Address ────────────────────────────────────────────────

async function handleCheck(email, env) {
  if (!email) return json({ error: "Missing email param" }, 400);
  const addrRaw = await env.MAIL_STORAGE.get(`addr:${email}`);
  return json({ email, exists: !!addrRaw });
}

// ─── Inbox ────────────────────────────────────────────────────────

async function handleInbox(email, env) {
  const inboxRaw = await env.MAIL_STORAGE.get(`inbox:${email}`);

  if (!inboxRaw) {
    const addrRaw = await env.MAIL_STORAGE.get(`addr:${email}`);
    if (addrRaw) {
      await env.MAIL_STORAGE.put(`inbox:${email}`, JSON.stringify([]), {
        expirationTtl: ADDRESS_TTL,
      });
      return json({ email, messages: [], expiresIn: EMAIL_TTL, refreshed: true });
    }
    return json({ email, messages: [], expiresIn: 0, notFound: true });
  }

  const messageIds = JSON.parse(inboxRaw);
  const messages = [];
  const validIds = [];

  for (const msgId of messageIds) {
    const mailRaw = await env.MAIL_STORAGE.get(`mail:${email}:${msgId}`);
    if (mailRaw) {
      const mail = JSON.parse(mailRaw);
      validIds.push(msgId);
      messages.push({
        id: mail.messageId,
        from: mail.from,
        subject: mail.subject,
        snippet: (mail.textBody || "").substring(0, 120),
        timestamp: mail.timestamp,
      });
    }
  }

  // Cleanup stale references
  if (validIds.length !== messageIds.length) {
    await env.MAIL_STORAGE.put(`inbox:${email}`, JSON.stringify(validIds), {
      expirationTtl: ADDRESS_TTL,
    });
  }

  messages.sort((a, b) => b.timestamp - a.timestamp);
  return json({ email, messages, expiresIn: EMAIL_TTL });
}

// ─── Read Single Email ────────────────────────────────────────────

async function handleReadMail(email, messageId, env) {
  const mailRaw = await env.MAIL_STORAGE.get(`mail:${email}:${messageId}`);
  if (!mailRaw) return json({ error: "Email not found or expired" }, 404);
  return json(JSON.parse(mailRaw));
}

// ─── Email Inbound Handler ────────────────────────────────────────

async function handleEmail(message, env) {
  const to = message.to;
  const from = message.from;
  const subject = decodeMimeHeader(message.headers.get("subject")) || "(no subject)";
  const messageId =
    message.headers.get("message-id") ||
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Only accept mail for known addresses
  const addrRaw = await env.MAIL_STORAGE.get(`addr:${to}`);
  if (!addrRaw) return;

  let textBody = "";
  let htmlBody = "";

  try {
    const rawBody = await new Response(message.raw).text();
    const contentType = message.headers.get("content-type") || "";

    if (contentType.includes("multipart/")) {
      const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = rawBody.split(`--${boundary}`);
        for (const part of parts) {
          const lower = part.toLowerCase();
          if (lower.includes("text/plain") && !textBody) {
            textBody = extractBody(part);
            if (textBody.endsWith("--")) textBody = textBody.slice(0, -2).trim();
          } else if (lower.includes("text/html") && !htmlBody) {
            htmlBody = extractBody(part);
            if (htmlBody.endsWith("--")) htmlBody = htmlBody.slice(0, -2).trim();
          }
        }
      }
    }

    if (!textBody && !htmlBody) textBody = rawBody;
  } catch (e) {
    textBody = "(error reading body: " + (e.message || e) + ")";
  }

  const cleanId = messageId.replace(/[<>]/g, "").replace(/[^a-zA-Z0-9._@-]/g, "_");

  // Store email
  await env.MAIL_STORAGE.put(
    `mail:${to}:${cleanId}`,
    JSON.stringify({ messageId: cleanId, from, to, subject, textBody, htmlBody, timestamp: Date.now() }),
    { expirationTtl: EMAIL_TTL }
  );

  // Update inbox list
  let inboxIds = [];
  try {
    const inboxRaw = await env.MAIL_STORAGE.get(`inbox:${to}`);
    if (inboxRaw) {
      inboxIds = JSON.parse(inboxRaw);
      if (!Array.isArray(inboxIds)) inboxIds = [];
    }
  } catch {
    inboxIds = [];
  }

  if (!inboxIds.includes(cleanId)) inboxIds.push(cleanId);

  await env.MAIL_STORAGE.put(`inbox:${to}`, JSON.stringify(inboxIds), {
    expirationTtl: ADDRESS_TTL,
  });
}

// ─── Export ───────────────────────────────────────────────────────

export default {
  fetch: handleRequest,
  email: handleEmail,
};
