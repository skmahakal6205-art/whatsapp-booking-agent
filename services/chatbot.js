/**
 * ============================================
 * Chatbot Engine — Core Conversation Logic
 * ============================================
 * State machine driving the WhatsApp conversation.
 */

const sessionManager = require('./session');
const bookingStore = require('./bookingStore');
const calendarService = require('./calendar');
const crmService = require('./crm');
const paymentService = require('./payment');
const whatsapp = require('./whatsapp');
const messages = require('../config/messages');
const salonConfig = require('../config/salon');
const { INTENT, detectIntent, detectService, detectDate, detectTime, detectBookingDetails } = require('./intent');

/**
 * Process an incoming message and return the response.
 */
async function processMessage(from, message, profileName) {
  const session = sessionManager.get(from);

  // Store profile name if available
  if (profileName && !session.profileName) {
    sessionManager.update(from, { profileName });
  }

  // If human handoff is active, ignore automation
  if (session.humanHandoff) {
    return null; // Don't respond — human is handling
  }

  console.log(`[Bot] ${from} | State: ${session.state} | Message: "${message}"`);

  try {
    switch (session.state) {
      case 'WELCOME':
        return await handleWelcome(from, message, session);

      case 'ASK_NAME':
        return await handleAskName(from, message, session);

      case 'ASK_SERVICE':
        return await handleAskService(from, message, session);

      case 'ASK_DATE':
        return await handleAskDate(from, message, session);

      case 'ASK_TIME':
        return await handleAskTime(from, message, session);

      case 'CONFIRM_BOOKING':
        return await handleConfirmBooking(from, message, session);

      case 'AWAIT_PAYMENT':
        return await handleAwaitPayment(from, message, session);

      case 'FEEDBACK':
        return await handleFeedback(from, message, session);

      case 'SLOT_SELECTION':
        return await handleSlotSelection(from, message, session);

      default:
        return await handleWelcome(from, message, session);
    }
  } catch (error) {
    console.error(`[Bot] Error processing message from ${from}:`, error);
    return messages.invalidInput;
  }
}

function getBookingDetails(message) {
  return detectBookingDetails(message);
}

async function startBookingFlow(from, message, session, details) {
  const { service, date, time } = details;
  const updates = {};

  if (service && !session.serviceId) {
    updates.serviceId = service.id;
    updates.serviceName = service.name;
    updates.servicePrice = service.price;
    updates.serviceDuration = service.duration;
  }

  if (date && !session.date) {
    updates.date = date;
  }

  if (time && !session.time) {
    updates.time = time;
  }

  if (!session.customerName && session.profileName) {
    updates.customerName = session.profileName;
  }

  sessionManager.update(from, updates);
  const current = sessionManager.get(from);

  if (!current.customerName) {
    sessionManager.update(from, { state: 'ASK_NAME' });
    return messages.askName;
  }

  if (!current.serviceId) {
    sessionManager.update(from, { state: 'ASK_SERVICE' });
    return messages.askService();
  }

  if (!current.date) {
    sessionManager.update(from, { state: 'ASK_DATE' });
    return messages.askDate;
  }

  if (!current.time) {
    sessionManager.update(from, { state: 'ASK_TIME' });
    return messages.askTime(current.date);
  }

  sessionManager.update(from, { state: 'CONFIRM_BOOKING' });

  return (
    messages.bookingConfirmed({
      customerName: current.customerName,
      serviceName: current.serviceName,
      date: current.date,
      time: current.time,
      price: current.servicePrice,
    }) +
    '\n\n' +
    `Would you like to pay ₹${salonConfig.advanceBookingFee} advance to confirm?\n\n` +
    `Reply *yes* to proceed or *no* to skip payment.`
  );
}

// ============================================
// State Handlers
// ============================================

async function handleWelcome(from, message, session) {
  const intent = detectIntent(message);
  const bookingDetails = getBookingDetails(message);

  // Automatically start booking if the customer mentions a service, date, or time.
  if (
    intent === INTENT.BOOK ||
    bookingDetails.service ||
    bookingDetails.date ||
    bookingDetails.time
  ) {
    return await startBookingFlow(from, message, session, bookingDetails);
  }

  switch (intent) {
    case INTENT.SERVICES:
      // Stay in WELCOME state after showing services
      return messages.servicesList();

    case INTENT.HUMAN:
      return await initiateHumanHandoff(from, session);

    default:
      // First message — show welcome
      if (session.retryCount === 0) {
        sessionManager.update(from, { retryCount: 1 });
        return messages.welcome(session.profileName);
      }

      // Subsequent unclear messages
      sessionManager.update(from, { retryCount: (session.retryCount || 0) + 1 });

      if (session.retryCount >= 3) {
        // After 3 retries, show welcome again
        sessionManager.update(from, { retryCount: 0 });
        return messages.welcome(session.profileName);
      }

      return messages.invalidInput;
  }
}

async function handleAskName(from, message, session) {
  const name = message.trim();

  if (name.length < 2 || name.length > 50) {
    return 'Please enter a valid name (2–50 characters) 🙏';
  }

  sessionManager.update(from, {
    customerName: name,
    state: 'ASK_SERVICE',
  });

  return messages.askService();
}

async function handleAskService(from, message, session) {
  const service = detectService(message);

  if (!service) {
    return messages.invalidService();
  }

  sessionManager.update(from, {
    serviceId: service.id,
    serviceName: service.name,
    servicePrice: service.price,
    serviceDuration: service.duration,
    state: 'ASK_DATE',
  });

  return messages.askDate;
}

async function handleAskDate(from, message, session) {
  const date = detectDate(message);

  if (!date) {
    return messages.invalidDate;
  }

  sessionManager.update(from, {
    date: date,
    state: 'ASK_TIME',
  });

  return messages.askTime(date);
}

async function handleAskTime(from, message, session) {
  const time = detectTime(message);

  if (!time) {
    return messages.invalidTime;
  }

  // Check calendar availability
  try {
    const availability = await calendarService.checkAvailability(
      session.date,
      time,
      session.serviceDuration || 30
    );

    if (!availability.available) {
      if (availability.alternatives.length > 0) {
        sessionManager.update(from, {
          state: 'SLOT_SELECTION',
          _alternatives: availability.alternatives,
        });
        return messages.slotUnavailable(availability.alternatives);
      }
      return messages.invalidTime;
    }
  } catch (error) {
    console.error('[Bot] Calendar check failed, proceeding anyway:', error.message);
  }

  sessionManager.update(from, {
    time: time,
    state: 'CONFIRM_BOOKING',
  });

  // Show confirmation preview
  const booking = {
    customerName: session.customerName,
    serviceName: session.serviceName,
    date: session.date,
    time: time,
    price: session.servicePrice,
  };

  return (
    messages.bookingConfirmed(booking) +
    '\n\n' +
    `Would you like to pay ₹${salonConfig.advanceBookingFee} advance to confirm?\n\n` +
    `Reply *yes* to proceed or *no* to skip payment.`
  );
}

async function handleSlotSelection(from, message, session) {
  const msg = message.trim();
  const num = parseInt(msg);
  const alternatives = session._alternatives || [];

  // Check if user selected a slot number
  if (!isNaN(num) && num >= 1 && num <= alternatives.length) {
    const selectedTime = alternatives[num - 1];

    sessionManager.update(from, {
      time: selectedTime,
      state: 'CONFIRM_BOOKING',
    });

    const booking = {
      customerName: session.customerName,
      serviceName: session.serviceName,
      date: session.date,
      time: selectedTime,
      price: session.servicePrice,
    };

    return (
      messages.bookingConfirmed(booking) +
      '\n\n' +
      `Would you like to pay ₹${salonConfig.advanceBookingFee} advance to confirm?\n\n` +
      `Reply *yes* to proceed or *no* to skip payment.`
    );
  }

  // Check if user typed a time directly
  const time = detectTime(msg);
  if (time) {
    sessionManager.update(from, { state: 'ASK_TIME' });
    return await handleAskTime(from, msg, sessionManager.get(from));
  }

  return 'Please select a slot number or type a new time 🙏';
}

async function handleConfirmBooking(from, message, session) {
  const intent = detectIntent(message);

  // Create the booking
  const booking = bookingStore.create({
    phone: from,
    customerName: session.customerName,
    serviceId: session.serviceId,
    serviceName: session.serviceName,
    price: session.servicePrice,
    duration: session.serviceDuration,
    date: session.date,
    time: session.time,
  });

  // Create calendar event (async, don't block)
  createCalendarEvent(booking).catch((e) =>
    console.error('[Bot] Calendar event failed:', e.message)
  );

  // Upsert CRM contact (async, don't block)
  upsertCRM(from, booking).catch((e) =>
    console.error('[Bot] CRM upsert failed:', e.message)
  );

  if (intent === INTENT.YES) {
    // Generate payment link
    try {
      const payment = await paymentService.createPaymentLink({
        amount: salonConfig.advanceBookingFee,
        customerName: session.customerName,
        phone: from,
        description: `Advance for ${session.serviceName}`,
        bookingId: booking.id,
      });

      bookingStore.update(booking.id, {
        paymentLinkId: payment.id,
      });

      sessionManager.update(from, {
        state: 'AWAIT_PAYMENT',
        bookingId: booking.id,
        paymentLinkId: payment.id,
        paymentLink: payment.shortUrl,
        paymentAmount: payment.amount,
      });

      return messages.paymentRequest(payment.amount, payment.shortUrl);
    } catch (error) {
      console.error('[Bot] Payment link creation failed:', error.message);
      // Fallback: confirm without payment
      bookingStore.update(booking.id, { status: 'confirmed' });
      sessionManager.reset(from);
      return (
        '✅ Booking confirmed without advance payment.\n\n' +
        messages.bookingConfirmed({
          customerName: session.customerName,
          serviceName: session.serviceName,
          date: session.date,
          time: session.time,
          price: session.servicePrice,
        })
      );
    }
  } else {
    // Skip payment — confirm directly
    bookingStore.update(booking.id, { status: 'confirmed', paymentStatus: 'skipped' });
    sessionManager.reset(from);

    return (
      '✅ *Booking Confirmed* (no advance payment)\n\n' +
      `We'll send you reminders before your appointment!\n\n` +
      `See you at *${salonConfig.name}*! 🙌`
    );
  }
}

async function handleAwaitPayment(from, message, session) {
  // Check payment status
  if (session.paymentLinkId) {
    try {
      const status = await paymentService.checkPaymentStatus(session.paymentLinkId);

      if (status.paid) {
        bookingStore.update(session.bookingId, {
          status: 'confirmed',
          paymentStatus: 'paid',
        });
        sessionManager.reset(from);
        return messages.paymentSuccess;
      }
    } catch (error) {
      console.error('[Bot] Payment check failed:', error.message);
    }
  }

  // If user sends any message while waiting, check status + provide info
  const intent = detectIntent(message);

  if (intent === INTENT.YES || message.toLowerCase().includes('paid') || message.toLowerCase().includes('done')) {
    // Check again
    try {
      const status = await paymentService.checkPaymentStatus(session.paymentLinkId);
      if (status.paid) {
        bookingStore.update(session.bookingId, {
          status: 'confirmed',
          paymentStatus: 'paid',
        });
        sessionManager.reset(from);
        return messages.paymentSuccess;
      }
    } catch (e) { /* ignore */ }

    return 'Payment not received yet. Please complete the payment using the link above 🙏';
  }

  if (intent === INTENT.NO) {
    // Skip payment
    bookingStore.update(session.bookingId, {
      status: 'confirmed',
      paymentStatus: 'skipped',
    });
    sessionManager.reset(from);
    return '✅ Booking confirmed without advance payment. See you soon! 🙌';
  }

  return `Your booking is waiting for payment.\n\n💳 ${session.paymentLink}\n\nReply *done* after payment or *no* to skip.`;
}

async function handleFeedback(from, message, session) {
  const msg = message.trim();
  let intent;

  // Number-based feedback
  if (msg === '1') intent = INTENT.FEEDBACK_POSITIVE;
  else if (msg === '2') intent = INTENT.FEEDBACK_NEUTRAL;
  else if (msg === '3') intent = INTENT.FEEDBACK_NEGATIVE;
  else intent = detectIntent(message);

  const name = session.customerName || session.profileName || 'there';
  const booking = session.bookingId ? bookingStore.get(session.bookingId) : null;

  switch (intent) {
    case INTENT.FEEDBACK_POSITIVE:
      if (booking) {
        bookingStore.update(booking.id, {
          feedbackReceived: true,
          feedbackScore: 'positive',
          status: 'completed',
        });
      }
      sessionManager.reset(from);

      // Send referral offer after positive feedback (delayed)
      setTimeout(async () => {
        try {
          await whatsapp.sendMessage(from, messages.referralOffer(name));
          if (booking) bookingStore.update(booking.id, { referralSent: true });
        } catch (e) {
          console.error('[Bot] Referral message failed:', e.message);
        }
      }, 5000);

      return messages.feedbackPositive(name);

    case INTENT.FEEDBACK_NEUTRAL:
      if (booking) {
        bookingStore.update(booking.id, {
          feedbackReceived: true,
          feedbackScore: 'neutral',
          status: 'completed',
        });
      }
      sessionManager.reset(from);
      return messages.feedbackNeutral(name);

    case INTENT.FEEDBACK_NEGATIVE:
      if (booking) {
        bookingStore.update(booking.id, {
          feedbackReceived: true,
          feedbackScore: 'negative',
          status: 'completed',
        });
      }
      // Notify owner about negative feedback
      try {
        await whatsapp.sendMessage(
          salonConfig.ownerPhone,
          `⚠️ *Negative Feedback*\n\nCustomer: ${name}\nPhone: ${from}\n\nPlease follow up!`
        );
      } catch (e) { /* ignore */ }
      sessionManager.reset(from);
      return messages.feedbackNegative(name);

    default:
      return messages.feedbackRequest(name);
  }
}

// ============================================
// Helper Functions
// ============================================

async function initiateHumanHandoff(from, session) {
  sessionManager.update(from, { humanHandoff: true });

  // Notify salon owner
  try {
    await whatsapp.sendMessage(
      salonConfig.ownerPhone,
      messages.humanHandoffOwner(from, session.customerName || session.profileName)
    );
  } catch (error) {
    console.error('[Bot] Human handoff notification failed:', error.message);
  }

  return messages.humanHandoff;
}

async function createCalendarEvent(booking) {
  try {
    const event = await calendarService.createEvent(booking);
    bookingStore.update(booking.id, { calendarEventId: event.id });
  } catch (error) {
    console.error('[Bot] Calendar event creation failed:', error.message);
  }
}

async function upsertCRM(phone, booking) {
  try {
    const result = await crmService.upsertContact({
      name: booking.customerName,
      phone: phone,
      service: booking.serviceName,
      appointmentDate: `${booking.date} ${booking.time}`,
    });

    bookingStore.update(booking.id, { crmContactId: result.contactId });

    // Create deal
    await crmService.createDeal({
      contactId: result.contactId,
      name: booking.customerName,
      service: booking.serviceName,
      price: booking.price,
      appointmentDate: `${booking.date} ${booking.time}`,
    });
  } catch (error) {
    console.error('[Bot] CRM upsert failed:', error.message);
  }
}

module.exports = { processMessage };
