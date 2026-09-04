# Bank Statement DB API

A tiny Node/Express API that saves **Date + Description** rows from the
"Bank Statement to Excel" tool into a Railway PostgreSQL database.

## Deploy on Railway (separate from your existing failed service)

Your current Railway service is failing because it's trying to build a
leftover `Dockerfile` from the MarkItDown source code you uploaded into
`Kenny-Office-Tools` earlier — that Dockerfile has nothing to do with this
database. The cleanest fix is to deploy **this** folder as its own service.

1. In your GitHub repo (`kennypoh123/Kenny-Office-Tools`), create a new
   folder, e.g. `bank-statement-api/`, and upload these 3 files into it:
   `server.js`, `package.json`, `README.md`.
2. In Railway, either:
   - Create a **new service** in the same project, pointing at this repo,
     and set its **Root Directory** (in Settings) to `bank-statement-api`.
     This makes Railway ignore the root `Dockerfile` and build only this
     folder with Node — or
   - Fix the existing failing service by setting its **Root Directory** to
     `bank-statement-api` the same way.
3. In that service, go to **Variables** and link the Postgres database you
   already provisioned (Railway usually offers "Add Variable Reference" ->
   pick your Postgres plugin's `DATABASE_URL`). This auto-injects
   `DATABASE_URL` into the service.
4. (Optional but recommended) Add an `ALLOWED_ORIGIN` variable set to
   `https://kennypoh123.github.io` so only your site can call this API.
5. Deploy. Railway will run `npm install` then `npm start` automatically
   (no Dockerfile needed — it detects Node from `package.json`).
6. Once deployed, Railway gives you a public URL like
   `https://bank-statement-api-production.up.railway.app`. Copy it.

## Test it

```
curl https://YOUR-RAILWAY-URL/api/health
# {"ok":true}

curl -X POST https://YOUR-RAILWAY-URL/api/transactions \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"date":"2026-02-14","description":"CIB Instant Transfer - Ban Lee Vegetables"}]}'

curl https://YOUR-RAILWAY-URL/api/transactions
```

## Connect it to your Bank Statement to Excel page

In `bank-statement-excel.html`, set the `API_URL` constant near the top of
the `<script>` block to your Railway URL, then use the new
"💾 Save to Database" button to send the Date + Description of every
ticked transaction row to this API.
