/**
 * ============================================
 * Message Templates — All WhatsApp Messages
 * ============================================
 * Edit any message copy here.
 */

const salon = require('./salon');

const messages = {
  // ---- Welcome ----
  welcome: (name) =>
    `Hey${name ? ' ' + name : ''} 👋 Welcome to *${salon.name}*!\n\n` +
    `How can we help you today?\n\n` +
    `1️⃣ *Book Appointment*\n` +
    `2️⃣ *Services & Pricing*\n` +
    `3️⃣ *Talk to Staff*\n\n` +
    `Just reply with 1, 2 or 3 🙂`,

  // ---- Services ----
  servicesList: () =>
    `Here are our services at *${salon.name}* 💈\n\n` +
    salon.formatServiceList() +
    `\n\n💬 Want to book? Just reply *1* to book an appointment!`,

  // ---- Booking Flow ----
  askName: 'Sure! Let\'s book your appointment 📅\n\nWhat\'s your name?',

  askService: () =>
    `Great! Which service would you like?\n\n` +
    salon.formatServiceList() +
    `\n\nReply with the *service name* or *number*.`,

  askDate: 'When would you like to come?\n\nPlease share the *date* (e.g. 5 April, tomorrow, next Monday)',

  askTime: (date) =>
    `Got it! 📅 *${date}*\n\nWhat time works for you?\n` +
    `We\'re open from *${salon.openTime}* to *${salon.closeTime}*\n\n` +
    `Reply with a time (e.g. 2:00 PM, 4:30 PM)`,

  // ---- Booking Confirmation ----
  bookingConfirmed: (booking) =>
    `✅ *Appointment Confirmed!*\n\n` +
    `👤 Name: *${booking.customerName}*\n` +
    `💇 Service: *${booking.serviceName}*\n` +
    `📅 Date: *${booking.date}*\n` +
    `🕐 Time: *${booking.time}*\n` +
    `💰 Price: *₹${booking.price}*\n\n` +
    `See you at *${salon.name}*! 🙌`,

  slotUnavailable: (alternatives) =>
    `😕 Sorry, that slot is not available.\n\n` +
    `Here are some open slots:\n` +
    alternatives.map((t, i) => `${i + 1}. 🕐 ${t}`).join('\n') +
    `\n\nReply with a *number* to pick a slot, or type another time.`,

  // ---- Payment ----
  paymentRequest: (amount, link) =>
    `To confirm your booking, please pay an advance of *₹${amount}*:\n\n` +
    `💳 ${link}\n\n` +
    `Your booking will be finalized once payment is received.`,

  paymentReminder: (amount, link) =>
    `⏰ Reminder: Your advance payment of *₹${amount}* is still pending.\n\n` +
    `💳 ${link}\n\n` +
    `Pay now to confirm your appointment!`,

  paymentSuccess: '✅ Payment received! Your booking is confirmed. See you soon! 🎉',

  // ---- Reminders ----
  reminder24h: (booking) =>
    `📅 *Appointment Reminder*\n\n` +
    `Hey ${booking.customerName}! Just a reminder — you have an appointment tomorrow:\n\n` +
    `💇 ${booking.serviceName}\n` +
    `🕐 ${booking.time}\n` +
    `📍 ${salon.name}\n\n` +
    `See you there! 💪`,

  reminder2h: (booking) =>
    `⏰ *Almost Time!*\n\n` +
    `Hey ${booking.customerName}, your appointment is in *2 hours*:\n\n` +
    `💇 ${booking.serviceName}\n` +
    `🕐 ${booking.time}\n\n` +
    `We're excited to see you! 🙌`,

  // ---- Follow-up ----
  feedbackRequest: (name) =>
    `Hey ${name}! 😊\n\n` +
    `How was your experience at *${salon.name}*?\n\n` +
    `1️⃣ ⭐ Loved it!\n` +
    `2️⃣ 😐 It was okay\n` +
    `3️⃣ 😞 Not great\n\n` +
    `Your feedback helps us improve! 💬`,

  feedbackPositive: (name) =>
    `Thank you so much, ${name}! 🎉\n\n` +
    `Here\'s a special reward for you:\n` +
    `🎁 *${salon.offers.feedbackDiscount}*\n\n` +
    `Use it on your next visit! 💈`,

  feedbackNeutral: (name) =>
    `Thanks for your honest feedback, ${name}. ` +
    `We'll work on improving! 🙏\n\n` +
    `Anything specific we can do better?`,

  feedbackNegative: (name) =>
    `We're really sorry, ${name} 😔\n\n` +
    `Your experience matters to us. Our team will reach out to you shortly to make it right. 🤝`,

  // ---- Referral ----
  referralOffer: (name) =>
    `Hey ${name}! 🤝\n\n` +
    `Love our service? *${salon.offers.referral}*\n\n` +
    `Share this message with your friends and both of you get rewarded! 🎁`,

  // ---- Reactivation ----
  reactivation: (name) =>
    `Hey ${name}! 👋\n\n` +
    `We miss you at *${salon.name}*! 💈\n\n` +
    `🎁 *${salon.offers.reactivation}*\n\n` +
    `Book now — reply *1* to schedule! 📅`,

  // ---- Human Handoff ----
  humanHandoff: salon.humanHandoffMessage +
    '\n\nOur team will reply shortly. You can continue chatting here.',

  humanHandoffOwner: (phone, name) =>
    `🔔 *Human Handoff Required*\n\n` +
    `Customer: ${name || 'Unknown'}\n` +
    `Phone: ${phone}\n\n` +
    `Please respond to this customer on WhatsApp.`,

  // ---- Error ----
  invalidInput:
    `Oops! I didn't quite get that 😅\n\n` +
    `You can type something like:\n` +
    `• Book haircut tomorrow at 4pm\n` +
    `• Show me services and prices\n` +
    `• Talk to staff\n\n` +
    `Or reply with:\n` +
    `1️⃣ *Book Appointment*\n` +
    `2️⃣ *Services & Pricing*\n` +
    `3️⃣ *Talk to Staff*`,

  invalidService: () =>
    `Hmm, I couldn't find that service 🤔\n\n` +
    `Here's what we offer:\n` +
    salon.formatServiceList() +
    `\n\nPlease reply with the *service name* or *number*.`,

  invalidDate: 'That doesn\'t look like a valid date 🤔\n\nPlease try again (e.g. *5 April*, *tomorrow*, *next Monday*).',

  invalidTime: `That doesn't look like a valid time 🤔\n\nPlease try a format like *2:00 PM* or *16:30*.`,

  sessionExpired:
    `It looks like your session timed out ⏳\n\n` +
    `No worries! Let\'s start fresh:\n\n` +
    `1️⃣ *Book Appointment*\n` +
    `2️⃣ *Services & Pricing*\n` +
    `3️⃣ *Talk to Staff*`,
};

module.exports = messages;
