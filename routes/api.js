/**
 * ============================================
 * API Routes
 * ============================================
 * Webhook endpoints + admin APIs.
 */

const express = require('express');
const router = express.Router();
const whatsapp = require('../services/whatsapp');
const { processMessage } = require('../services/chatbot');
const bookingStore = require('../services/bookingStore');
const sessionManager = require('../services/session');
const calendarService = require('../services/calendar');
const salonConfig = require('../config/salon');

// ============================================
// WhatsApp Webhook (Incoming Messages)
// ============================================

/**
 * POST /api/webhook
 * Receives incoming WhatsApp messages from WATI or Twilio.
 */
router.post('/webhook', async (req, res) => {
  try {
    const incoming = whatsapp.parseIncoming(req);

    if (!incoming.from || !incoming.message) {
      console.log('[Webhook] Ignoring empty message');
      return res.status(200).json({ status: 'ignored' });
    }

    console.log(`[Webhook] From: ${incoming.from} | Message: "${incoming.message}"`);

    // Process through chatbot engine
    const reply = await processMessage(
      incoming.from,
      incoming.message,
      incoming.profileName
    );

    // Send reply if chatbot returned one (null = human handoff)
    if (reply) {
      await whatsapp.sendMessage(incoming.from, reply);
    }

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Webhook] Error:', error.message);
    res.status(200).json({ status: 'error', message: error.message });
  }
});

/**
 * GET /api/webhook
 * Twilio webhook verification / health check.
 */
router.get('/webhook', (req, res) => {
  res.status(200).json({ status: 'WhatsApp webhook is active ✅' });
});

// ============================================
// Payment Callback
// ============================================

/**
 * GET /api/payment/callback
 * Razorpay redirects here after payment.
 */
router.get('/payment/callback', async (req, res) => {
  const { razorpay_payment_link_id, razorpay_payment_link_status } = req.query;

  if (razorpay_payment_link_status === 'paid') {
    // Find booking by payment link
    const allBookings = bookingStore.getAll();
    const booking = allBookings.find((b) => b.paymentLinkId === razorpay_payment_link_id);

    if (booking) {
      bookingStore.update(booking.id, {
        status: 'confirmed',
        paymentStatus: 'paid',
      });

      // Send confirmation
      try {
        const messages = require('../config/messages');
        await whatsapp.sendMessage(booking.phone, messages.paymentSuccess);
        sessionManager.reset(booking.phone);
      } catch (e) {
        console.error('[Payment Callback] WhatsApp notification failed:', e.message);
      }
    }
  }

  res.send(`
    <html>
      <body style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h1>✅ Payment Received!</h1>
        <p>Your salon appointment has been confirmed.</p>
        <p>You'll receive a confirmation on WhatsApp shortly.</p>
      </body>
    </html>
  `);
});

// ============================================
// Google Calendar Auth Setup
// ============================================

/**
 * GET /auth/google
 * Start Google OAuth flow for calendar setup.
 */
router.get('/auth/google', (req, res) => {
  const url = calendarService.getAuthUrl();
  res.redirect(url);
});

/**
 * GET /auth/google/callback
 * Google OAuth callback.
 */
router.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing auth code');

  try {
    const tokens = await calendarService.getTokenFromCode(code);
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 50px;">
          <h1>✅ Google Calendar Connected!</h1>
          <p>Add this to your <code>.env</code> file:</p>
          <pre style="background: #f0f0f0; padding: 20px; border-radius: 8px;">
GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}
          </pre>
          <p>Then restart the server.</p>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send(`Auth failed: ${error.message}`);
  }
});

// ============================================
// Admin APIs
// ============================================

/**
 * GET /api/admin/bookings
 * List all bookings.
 */
router.get('/admin/bookings', (req, res) => {
  const bookings = bookingStore.getAll();
  res.json({ count: bookings.length, bookings });
});

/**
 * GET /api/admin/stats
 * Booking statistics.
 */
router.get('/admin/stats', (req, res) => {
  res.json(bookingStore.getStats());
});

/**
 * GET /api/admin/sessions
 * Active conversation sessions.
 */
router.get('/admin/sessions', (req, res) => {
  res.json(sessionManager.getAll());
});

/**
 * POST /api/admin/resume/:phone
 * Resume automation for a customer (after human handoff).
 */
router.post('/admin/resume/:phone', (req, res) => {
  const phone = req.params.phone;
  const session = sessionManager.get(phone);
  sessionManager.update(phone, { humanHandoff: false, state: 'WELCOME' });
  res.json({ status: 'ok', message: `Automation resumed for ${phone}` });
});

/**
 * GET /api/admin/config
 * Get current salon config.
 */
router.get('/admin/config', (req, res) => {
  res.json({
    name: salonConfig.name,
    openTime: salonConfig.openTime,
    closeTime: salonConfig.closeTime,
    services: salonConfig.services,
    advanceBookingFee: salonConfig.advanceBookingFee,
    offers: salonConfig.offers,
  });
});

/**
 * POST /api/admin/send
 * Manually send a WhatsApp message (for testing).
 */
router.post('/admin/send', async (req, res) => {
  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message required' });
  }

  try {
    await whatsapp.sendMessage(phone, message);
    res.json({ status: 'sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/test/simulate
 * Simulate an incoming WhatsApp message (for testing without real WhatsApp).
 */
router.post('/test/simulate', async (req, res) => {
  const { phone, message, name } = req.body;

  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message required' });
  }

  try {
    const reply = await processMessage(phone, message, name || 'Test User');
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
