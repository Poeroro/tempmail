# TempMail

Disposable email service powered by Cloudflare Workers + Pages.

## Features

- Generate random temp email addresses from a username pool
- Receive emails in real-time (Cloudflare Email Routing)
- Auto-delete emails after 30 minutes
- Addresses persist for 1 year
- Dark/light theme
- Responsive mobile UI
- Restore previous addresses from history

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│  mail.yourdomain │────▶│  Cloudflare Pages    │
│  (frontend)      │     │  public/             │
└─────────────────┘     └──────────────────────┘
        │
        ▼ API calls
┌─────────────────┐     ┌──────────────────────┐
│  api.yourdomain  │────▶│  Cloudflare Worker   │
│  (backend)       │     │  src/worker.js       │
└─────────────────┘     └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  Cloudflare KV       │
                        │  (MAIL_STORAGE)      │
                        └──────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/generate` | Generate new temp email |
| POST | `/api/restore` | Restore existing address |
| GET | `/api/check?email=` | Check if address exists |
| GET | `/api/inbox/{email}` | List inbox messages |
| GET | `/api/mail/{email}/{id}` | Read single email |

## Project Structure

```
tempmail/
├── src/
│   ├── worker.js      # Worker API + email handler
│   └── usernames.js   # Username pool (1001 names)
├── public/
│   ├── index.html     # Frontend HTML
│   ├── app.js         # Frontend JS
│   ├── style.css      # Styles (dark/light)
│   └── logo.svg       # SVG logo
├── wrangler.toml      # Wrangler config
├── package.json
└── README.md
```

## Setup

### Prerequisites

- Cloudflare account with Workers + Pages enabled
- `wrangler` CLI installed
- KV namespace created
- Email Routing configured for your domain

### Deploy

```bash
# Install deps
npm install

# Create KV namespace
wrangler kv:namespace create MAIL_STORAGE

# Update wrangler.toml with your KV namespace ID and domain

# Deploy Worker
wrangler deploy

# Deploy Pages frontend
wrangler pages deploy public --project-name=tempmail --branch=main
```

### DNS Setup

| Type | Name | Content | Proxied |
|------|------|---------|---------|
| CNAME | mail | your-pages-url.pages.dev | ✅ |
| AAAA | api | 100:: | ✅ |

Worker route: `api.yourdomain/*` → `tempmail`

### Email Routing

In Cloudflare Dashboard → Email Routing:
- Catch-all action: **Send to Worker** → `tempmail`

## License

MIT
