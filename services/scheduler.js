/**
 * ============================================
 * Scheduler — Automated Cron Jobs
 * ============================================
 * Handles reminders, follow-ups, payment checks,
 * and reactivation campaigns.
 */

const cron = require('node-cron');
const whatsapp = require('./whatsapp');
const bookingStore = require('./bookingStore');
const paymentService = require('./payment');
const crmService = require('./crm');
const sessionManager = require('./session');
const messages = require('../config/messages');
const salonConfig = require('../config/salon');

function startScheduler() {
  console.log('[Scheduler] Starting automated tasks...');

  // ---- Every 5 minutes: Check for appointment reminders ----
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Scheduler] Checking reminders...');
    const upcoming = bookingStore.getUpcomingBookings();

    for (const { booking, type } of upcoming) {
      try {
        if (type === '24h') {
          await whatsapp.sendMessage(booking.phone, messages.reminder24h(booking));
          bookingStore.update(booking.id, {
            remindersSent: { ...booking.remindersSent, twentyFourHour: true },
          });
          console.log(`[Scheduler] 24h reminder sent to ${booking.phone}`);
        }

        if (type === '2h') {
          await whatsapp.sendMessage(booking.phone, messages.reminder2h(booking));
          bookingStore.update(booking.id, {
            remindersSent: { ...booking.remindersSent, twoHour: true },
          });
          console.log(`[Scheduler] 2h reminder sent to ${booking.phone}`);
        }

        if (type === 'followup') {
          // Send feedback request 2 hours after appointment
          const name = booking.customerName;
          await whatsapp.sendMessage(booking.phone, messages.feedbackRequest(name));
          bookingStore.update(booking.id, { followUpSent: true });

          // Set session state to FEEDBACK so the bot handles the response
          sessionManager.update(booking.phone, {
            state: 'FEEDBACK',
            customerName: booking.customerName,
            bookingId: booking.id,
          });

          console.log(`[Scheduler] Follow-up sent to ${booking.phone}`);
        }
      } catch (error) {
        console.error(`[Scheduler] Failed for booking ${booking.id}:`, error.message);
      }
    }
  });

  // ---- Every 10 minutes: Check pending payments ----
  cron.schedule('*/10 * * * *', async () => {
    console.log('[Scheduler] Checking pending payments...');
    const pending = bookingStore.getPendingPayments();

    for (const booking of pending) {
      try {
        // First check if payment was made
        const status = await paymentService.checkPaymentStatus(booking.paymentLinkId);

        if (status.paid) {
          bookingStore.update(booking.id, {
            status: 'confirmed',
            paymentStatus: 'paid',
          });
          await whatsapp.sendMessage(booking.phone, messages.paymentSuccess);
          sessionManager.reset(booking.phone);
          console.log(`[Scheduler] Payment confirmed for ${booking.id}`);
        } else {
          // Send payment reminder
          const paymentLink = `Check your payment link`;
          await whatsapp.sendMessage(
            booking.phone,
            messages.paymentReminder(salonConfig.advanceBookingFee, paymentLink)
          );
          console.log(`[Scheduler] Payment reminder sent for ${booking.id}`);
        }
      } catch (error) {
        console.error(`[Scheduler] Payment check failed for ${booking.id}:`, error.message);
      }
    }
  });

  // ---- Daily at 10 AM: Reactivation campaign ----
  cron.schedule('0 10 * * *', async () => {
    console.log('[Scheduler] Running reactivation campaign...');
    try {
      const inactiveContacts = await crmService.getInactiveContacts(salonConfig.reactivationDays);

      for (const contact of inactiveContacts) {
        const name = contact.NAME || 'there';
        const phone = contact.PHONE?.[0]?.VALUE;

        if (!phone) continue;

        try {
          await whatsapp.sendMessage(phone, messages.reactivation(name));
          console.log(`[Scheduler] Reactivation sent to ${phone}`);
        } catch (e) {
          console.error(`[Scheduler] Reactivation failed for ${phone}:`, e.message);
        }

        // Rate limit: wait 2 seconds between messages
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('[Scheduler] Reactivation campaign failed:', error.message);
    }
  });

  console.log('[Scheduler] All cron jobs registered ✅');
}

module.exports = { startScheduler };
