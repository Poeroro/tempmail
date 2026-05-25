#!/bin/bash
# Deploy tempmail Worker (fetch + email handlers)
cd "$(dirname "$0")"

# Deploy Worker
echo "Deploying Worker..."
npx wrangler deploy

echo ""
echo "Worker deployed! Now configure Email Routing in dashboard:"
echo "1. Email Routing → Routing Rules → Catch-all"
echo "2. Set to: Send to a Worker → tempmail"
echo "3. Save"
