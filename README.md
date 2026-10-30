# Inbox Signal API

This repository contains the NestJS API, Prisma schema/migrations, and the
Docker Compose definition for the local application stack. The Compose file
builds the sibling `Frontend` folder as the web service. Gmail synchronization
is manual and read only. Ollama is an optional local AI service; notifications
use a mock WhatsApp provider by default.

## Prerequisites

- Node.js 22 or later and npm
- Bun 1.4 or later
- Docker Desktop with Docker Compose

## Run all services with Docker Compose (Windows CMD)

From the workspace folder containing both `Backend` and `Frontend`:

```cmd
copy Backend\.env.example Backend\.env
docker compose --env-file Backend\.env -f Backend\docker-compose.yml up --build
```

The values in `.env.example` are placeholders. Set every `replace-with-*` and
`your-google-*` value before starting the stack. Generate independent 32-byte
hex secrets in Windows CMD with:

```cmd
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use one output for `APP_SESSION_SECRET` and another for
`GMAIL_TOKEN_ENCRYPTION_KEY`. Choose your own long `APP_PASSPHRASE`. Keep the
OAuth client secret and encryption key private, and back up the encryption key
securely: changing it makes saved Gmail tokens unreadable. Replace the example
database password before using real data.
PostgreSQL becomes healthy before the API starts; the API applies Prisma
migrations before listening, and the frontend waits for the API health check.

- Dashboard: http://localhost:3000
- Backend health endpoint: http://localhost:3001/health
- PostgreSQL: localhost:5432

Stop the services with `Ctrl+C`, or from the workspace folder run:

```cmd
docker compose --env-file Backend\.env -f Backend\docker-compose.yml down
```

To also remove the local database volume (this deletes its data):

```cmd
docker compose --env-file Backend\.env -f Backend\docker-compose.yml down -v
```

## Run services locally (Windows CMD)

From the workspace folder, create local environment files:

```cmd
copy Backend\.env.example Backend\.env
copy Frontend\.env.example Frontend\.env
docker compose --env-file Backend\.env -f Backend\docker-compose.yml up -d database
```

In a first CMD window, start the API:

```cmd
cd /d "C:\Hard disk\AI Email Assistant\Backend"
bun install
bun run prisma:generate
bun run prisma:migrate
bun run start:dev
```

In a second CMD window, start the frontend:

```cmd
cd /d "C:\Hard disk\AI Email Assistant\Frontend"
npm ci
npm run dev
```

The frontend calls a same-origin Next.js route, which forwards requests to the
API using the server-only `BACKEND_API_URL` from `Frontend\.env`. This avoids
exposing backend configuration or credentials in browser code.

## Configure Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select
   a project and enable the **Gmail API**.
2. Configure the OAuth consent screen with the audience appropriate for your
   account. For an **External** app in **Testing**, add your Google account as a
   test user. Testing mode restricts authorization to listed test users, shows
   an unverified-app warning, and refresh tokens expire after seven days for
   scopes such as Gmail. Do not bypass these limits. Google classifies
   `gmail.readonly` as a **restricted** scope. Since this app reads and stores
   email data on its server, general public use requires Google's restricted
   scope verification and security assessment. Google documents a personal-use
   exception for an app used only by you (or a few personally known users); its
   user cap and unverified-app warning still apply. See Google's current
   [Gmail scope classification](https://developers.google.com/workspace/gmail/api/auth/scopes)
   and [verification guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
3. Create an OAuth client ID of type **Web application**. Add this exact
   Authorized redirect URI:
   `http://localhost:3000/api/gmail/callback`
4. Copy the client ID and client secret into `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET` in `Backend\.env`. Keep the redirect URI in sync with
   `GMAIL_REDIRECT_URI`. Google OAuth requires an exact redirect URI match.
5. Start the services, sign into the app with `APP_PASSPHRASE`, choose
   **Connect Gmail**, approve the read-only request, and use **Sync emails** to
   import a page. The scope requested is
   `https://www.googleapis.com/auth/gmail.readonly`.

## Automatic LinkedIn WhatsApp alerts

The backend checks the connected Gmail inbox every 60 seconds by default. It
stores new email and applies the category rules; only categories enabled under
**Alerts** can trigger a notification. The default alert category is LinkedIn,
and the default recipient is `+917994811405`. Change both in the Alerts view.
To change the check interval, set `GMAIL_AUTO_SYNC_INTERVAL_MS` (15,000 to
3,600,000 milliseconds). Each check fetches up to 25 newest messages by
default; change `GMAIL_AUTO_SYNC_LIMIT` to a value up to
`GMAIL_SYNC_MAX_LIMIT` if needed.

WhatsApp delivery defaults to `WHATSAPP_PROVIDER=mock`, which only writes a
simulated result to the delivery history. To send real messages, set up the
official [Meta WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started/):

1. Create a Meta app, add WhatsApp, and register a WhatsApp Business Platform
   sender phone number. Copy its **Phone Number ID** and create a permanent
   access token with WhatsApp messaging permission.
2. Add and get approval for a message template named
   `email_alert_notification` (or set another name). Its body must contain four
   text placeholders, in order: category, sender, subject, and email preview.
   Suggested template body: `New {{1}} email from {{2}}. Subject: {{3}}. Preview: {{4}}.`
   Business initiated WhatsApp messages require an approved template. Meta may
   charge for delivered template messages.
3. If you are using a Meta test sender, add `+917994811405` as an allowed test
   recipient. Confirm the full destination number and country code in **Alerts**.
4. Set these variables in `Backend\.env` (or the Compose `Backend\.env` file):

   ```env
   WHATSAPP_PROVIDER=cloud_api
   WHATSAPP_PHONE_NUMBER_ID=your-meta-phone-number-id
   WHATSAPP_ACCESS_TOKEN=your-meta-access-token
   WHATSAPP_API_VERSION=vXX.0
   WHATSAPP_TEMPLATE_NAME=email_alert_notification
   WHATSAPP_TEMPLATE_LANGUAGE=en_US
   ```

   Replace `vXX.0` with the Graph API version shown for your Meta app. Keep the
   access token private; do not paste it into chat or commit it to source
   control. Restart the backend after changing these values. Use **Test
   Notification** to verify delivery before relying on automatic alerts.

The backend polls the newest 25 Gmail messages once per minute by default. If Gmail is
disconnected, polling pauses until it is connected again. Category changes and
recipient changes take effect immediately; no messages are sent for older mail
already stored in the dashboard.

OAuth tokens are encrypted in PostgreSQL using AES-256-GCM and the backend-only
`GMAIL_TOKEN_ENCRYPTION_KEY`. Tokens are not sent to the browser. Disconnecting
revokes Google access where possible and deletes the connection and locally
stored messages.

## Optional local AI with Ollama

AI is disabled by default. Rule classification and the inbox continue working
without Ollama. Set `AI_ENABLED=true` in `Backend\.env`. With Docker Compose,
start the optional Ollama container and other services with:

```cmd
docker compose --env-file Backend\.env -f Backend\docker-compose.yml --profile ai up --build -d
docker compose --env-file Backend\.env -f Backend\docker-compose.yml exec ollama ollama pull llama3.2:3b
```

The model download is local to your machine and persisted in the `ollama_data`
volume. Keep `OLLAMA_BASE_URL=http://ollama:11434` for Compose. For a locally
installed Ollama with the API on localhost, use `OLLAMA_BASE_URL=http://localhost:11434`
and start Ollama before the backend. `OLLAMA_MODEL` selects the installed model;
`OLLAMA_TIMEOUT_MS` defaults to 10 seconds and is capped at 120 seconds.

In an email's detail panel, **Suggest category** asks Ollama for a validated
category, short reason, and confidence. If AI is disabled, times out, is
unavailable, or returns invalid JSON, the rule classifier supplies the
suggestion. The current category is never changed by a suggestion. **Apply
suggestion** is an explicit user action and marks the category as manually
chosen; the rule based **Reclassify** action skips manually chosen categories.
**Summarize with local AI** returns a short summary from the local Ollama
service. Email content is never sent to a cloud model, and the model has no tool
or notification interface.

Stop the Compose stack while retaining PostgreSQL and Ollama data with:

```cmd
docker compose --env-file Backend\.env -f Backend\docker-compose.yml down
```

To delete both persistent volumes as well, run `down -v`; this permanently
deletes local database records, Gmail tokens, and downloaded model files.

## Architecture and API

- **Frontend:** Next.js dashboard, same-origin API routes forward session cookies
  to the backend.
- **Backend:** NestJS modules for auth, Gmail OAuth/sync, email storage and
  filtering, rules, notifications, and optional local AI.
- **Database:** PostgreSQL through Prisma migrations. Gmail message IDs are
  unique; OAuth state is one time and bound to the signed in app session.
- **AI:** Ollama is opt in. Suggestions and summaries are requested by the user;
  model output cannot run tools, alter categories automatically, or dispatch
  notifications. AI category JSON is validated against the allowed category
  set and confidence range.
- **Notifications:** Rule driven. The configured provider in this app is the
  mock WhatsApp provider; it records test and matching deliveries locally.

Protected API endpoints (all require the app session cookie):

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/gmail/connect` | Start Google authorization |
| GET | `/gmail/callback` | Exchange authorization code and validate state |
| GET | `/gmail/status` | Read Gmail connection status |
| POST | `/gmail/sync` | Fetch one page of Gmail messages |
| DELETE | `/gmail/disconnect` | Revoke if possible and delete local messages/tokens |
| GET | `/emails` | Search/filter/paginate stored email |
| PATCH | `/emails/:id/category` | Manually choose a category |
| POST | `/emails/reclassify` | Apply rules to non-manual categories |
| POST | `/ai/emails/:id/category-suggestion` | Get a validated AI/rule suggestion |
| POST | `/ai/emails/:id/summary` | Summarize with local Ollama |
| GET/PUT | `/notifications/config` | Read/update notification settings |
| GET | `/notifications` | Read delivery history |
| POST | `/notifications/test` | Send a mock test notification |
| POST | `/notifications/:id/retry` | Retry a failed notification |

## RAG decision

RAG is not included in this phase. The current app stores a modest, user chosen
set of emails and already supports filtering by category, sender, date, read
state, subject, and snippet. A useful RAG scenario would be natural language
questions across many stored messages (for example, recruiter outreach received
this month) with evidence links. That requires embeddings, chunking, model
versioning, exclusion/deletion tracking, retrieval evaluation, and a vector
index. Those costs are not justified before users need semantic search. If that
use case becomes important, pgvector is a reasonable local PostgreSQL option;
answers should cite only retrieved email records. No email text is sent to an
external embedding or chat service here.

## Troubleshooting

- **Backend exits during startup:** replace the placeholder passphrase, session
  secret, Gmail encryption key, and Google OAuth values in `Backend\.env`.
  Generate two separate 64-character hex keys for the secrets.
- **Database connection or migration errors:** confirm Docker Desktop is
  running, then run `docker compose ... up -d database`; check that the
  `DATABASE_URL` database/user/password match the Compose PostgreSQL values.
- **Google `redirect_uri_mismatch`:** the OAuth client redirect URI and
  `GMAIL_REDIRECT_URI` must both be exactly
  `http://localhost:3000/api/gmail/callback` for this local setup.
- **Google says the app is unverified or access is denied:** add the account to
  the consent screen's test-user list. Testing refresh tokens expire after
  seven days for Gmail scopes; a personal-use exception may apply, while
  public availability requires Google's applicable review.
- **AI suggestions use rules:** verify `AI_ENABLED=true`, the configured local
  Ollama URL, and `ollama list` (or `docker compose ... exec ollama ollama list`)
  to confirm the selected model is installed. Rule suggestions remain
  available when Ollama is down. Summaries require Ollama to be available.
- **Frontend reports backend unavailable:** make sure `BACKEND_API_URL` in
  `Frontend\.env` is `http://localhost:3001` for local development, or use the
  Compose provided internal URL.

## Checks

```cmd
cd /d "C:\Hard disk\AI Email Assistant\Backend"
bun run lint
bun run test
bun run test:e2e
bun run build
```

```cmd
cd /d "C:\Hard disk\AI Email Assistant\Frontend"
npm run lint
npm run build
```

## Test the Gmail flow (Windows CMD)

After configuring `Backend\.env` and starting PostgreSQL, run the API and
frontend in separate CMD windows using the local development commands above.
Then open `http://localhost:3000`, sign in, connect Gmail, and press **Sync
emails**. For authenticated API checks from another CMD window:

```cmd
curl -i -c cookies.txt -H "Content-Type: application/json" -d "{\"passphrase\":\"YOUR_APP_PASSPHRASE\"}" http://localhost:3000/api/auth/login
curl -i -b cookies.txt http://localhost:3000/api/gmail/status
curl -i -b cookies.txt -H "Content-Type: application/json" -d "{\"limit\":25}" http://localhost:3000/api/gmail/sync
curl -i -b cookies.txt -X DELETE http://localhost:3000/api/gmail/disconnect
```

The Google approval step must still be completed in a browser. For the full
local validation, run the backend and frontend commands in **Checks**, then:

1. Sign into the dashboard, connect Gmail, and manually sync a page.
2. Open a message, request a category suggestion and summary. With Ollama off,
   category suggestions should say `rule fallback`; summaries report AI disabled.
3. Set a category manually, run **Reclassify**, and confirm the manual category
   remains unchanged.
4. In Notifications, configure a test recipient and send a test. The default
   mock provider records the delivery without contacting WhatsApp.
5. Use Docker Compose `down` and `up` to confirm data persists. Avoid `down -v`
   unless you intend to delete the persistent database and model volumes.

Automated checks do not complete Google OAuth against a real account. That
requires your own Google credentials, test-user consent, and a browser session.
