# WhatsApp Booking Agent

A salon booking assistant built to automate customer conversations over WhatsApp. This project enables a salon to receive booking requests, confirm appointments, collect payments, sync with Google Calendar, log CRM leads, and send follow-up messages without manual handling.

## Features

- WhatsApp receptionist for salon booking requests
- Conversational booking flow with service selection and appointment times
- Payment integration via Razorpay
- Google Calendar appointment sync
- CRM logging support for Bitrix24
- Admin endpoints for bookings, sessions, stats, and manual messaging
- Configurable salon services, pricing, working hours, and reminders
- Supports WATI and Twilio WhatsApp providers

## Tech Stack

- Node.js
- Express
- Twilio / WATI WhatsApp APIs
- Razorpay payments
- Google Calendar API
- Bitrix24 CRM integration

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Copy environment variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### 3. Configure `.env`

Set these values before running the server:

- `PORT` - Application port (default: `3000`)
- `BASE_URL` - Public URL for webhooks and callback redirects

WhatsApp provider options:

- `WHATSAPP_PROVIDER=wati`
  - `WATI_API_URL`
  - `WATI_API_TOKEN`

- `WHATSAPP_PROVIDER=twilio`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_WHATSAPP_NUMBER`

Google Calendar:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID`

Optional Google Gemini / Vertex AI:

- `GOOGLE_PROJECT_ID` - Google Cloud project ID
- `GOOGLE_API_KEY` - API key with Vertex AI permissions
- `GOOGLE_API_LOCATION` - Vertex AI region (default: `us-central1`)
- `GOOGLE_MODEL` - Gemini model name (default: `gemini-1.5-pro`)

CRM:

- `BITRIX24_WEBHOOK_URL`

Payments:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Salon config:

- `SALON_NAME`
- `SALON_OWNER_PHONE`
- `SALON_OPEN_TIME`
- `SALON_CLOSE_TIME`
- `SALON_SLOT_DURATION_MINS`

### 4. Run the server

```bash
npm start
```

Or run in development mode:

```bash
npm run dev
```

### 5. Open the dashboard

Visit:

```text
http://localhost:3000
```

## Key Endpoints

- `POST /api/webhook` - Receive incoming WhatsApp messages
- `GET /api/webhook` - Webhook health check
- `GET /api/payment/callback` - Razorpay payment callback
- `GET /auth/google` - Start Google Calendar OAuth
- `GET /auth/google/callback` - Google OAuth callback

Admin APIs:

- `GET /api/admin/bookings`
- `GET /api/admin/stats`
- `GET /api/admin/sessions`
- `POST /api/admin/resume/:phone`
- `GET /api/admin/config`
- `POST /api/admin/send`
- `POST /api/test/simulate`

## Project Structure

- `server.js` - Main Express server and app startup
- `routes/api.js` - Webhook routes, admin APIs, payment callbacks, and auth
- `services/` - Business logic for WhatsApp, booking, calendar, CRM, payment, sessions, scheduling, and chatbot flow
- `config/` - Salon settings and message templates
- `public/` - Static dashboard and assets

## Customization

- Update available salon services and pricing in `config/salon.js`
- Modify conversational messages in `config/messages.js`
- Adjust booked slot logic and reminders in service modules

## Notes

- Make sure the WhatsApp webhook URL is reachable from your provider
- For Google Calendar, authorize once via `/auth/google` and copy the refresh token into `.env`
- Use the admin endpoints for monitoring bookings and manually sending messages

## License

This project is provided as-is.
