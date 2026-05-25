# TempMail — Disposable Email Service

Free temporary email service powered by Cloudflare stack.

## Features

- 🚀 Generate disposable email addresses from a pool of 1000 usernames
- 📬 Real-time inbox with auto-polling
- 🔄 Restore previous email addresses (addresses never expire)
- ⏱️ Email content auto-deletes after 30 minutes
- 📋 Copy to clipboard with one click
- 🌙/☀️ Dark/Light mode with smooth animations
- 📱 Fully responsive design

## Stack

- **Frontend:** Vanilla HTML/CSS/JS → Cloudflare Pages
- **Backend:** Cloudflare Workers
- **Storage:** Cloudflare KV
- **Email:** Cloudflare Email Routing
- **Domain:** `tempmeil.xyz`

## Setup

### Prerequisites

- Node.js 18+
- Cloudflare account (free tier works)
- Domain added to Cloudflare

### 1. Install dependencies

```bash
npm install
```

### 2. Create KV namespace

```bash
npx wrangler kv namespace create MAIL_STORAGE
```

Update `wrangler.toml` with the returned KV namespace ID.

### 3. Configure domain

Set nameservers at your registrar to:
```
eugene.ns.cloudflare.com
ximena.ns.cloudflare.com
```

### 4. Deploy Worker

```bash
npx wrangler deploy
```

### 5. Deploy Frontend

```bash
npx wrangler pages deploy public/ --project-name=tempmail
```

### 6. Setup Email Routing

In Cloudflare Dashboard → Email Routing → Route to Worker `tempmail`.

## Project Structure

```
tempmail/
├── src/
│   └── worker.js      # API + Email handler + Username pool
├── public/
│   ├── index.html      # Frontend UI
│   ├── app.js          # Client-side logic
│   └── style.css       # Styles + animations
├── wrangler.toml       # Cloudflare config
└── package.json
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/generate` | Generate new temp email |
| `GET` | `/api/inbox/:email` | Fetch inbox for address |
| `POST` | `/api/restore` | Restore a previous email address |

## License

MIT
