/**
 * ============================================
 * Salon Configuration — All Editable Details
 * ============================================
 * Modify services, pricing, timings here.
 * No code changes needed elsewhere.
 */

const salonConfig = {
  name: process.env.SALON_NAME || 'JH BLENZ Salon & Academy',
  ownerPhone: process.env.SALON_OWNER_PHONE || '+919876543210',
  openTime: process.env.SALON_OPEN_TIME || '10:00',
  closeTime: process.env.SALON_CLOSE_TIME || '20:00',
  slotDurationMins: parseInt(process.env.SALON_SLOT_DURATION_MINS) || 30,

  // ---- Services & Pricing ----
  services: [
    { id: 'haircut',        name: 'Haircut',             price: 200,  duration: 30, emoji: '✂️' },
    { id: 'beard',          name: 'Beard Trim',          price: 100,  duration: 20, emoji: '🧔' },
    { id: 'facial',         name: 'Facial',              price: 500,  duration: 45, emoji: '🧖' },
    { id: 'hair_color',     name: 'Hair Color',          price: 800,  duration: 60, emoji: '🎨' },
    { id: 'hair_spa',       name: 'Hair Spa',            price: 600,  duration: 45, emoji: '💆' },
    { id: 'shave',          name: 'Clean Shave',         price: 80,   duration: 15, emoji: '🪒' },
    { id: 'head_massage',   name: 'Head Massage',        price: 150,  duration: 20, emoji: '💈' },
    { id: 'bridal_makeup',  name: 'Bridal Makeup',       price: 5000, duration: 120, emoji: '👰' },
    { id: 'manicure',       name: 'Manicure',            price: 300,  duration: 30, emoji: '💅' },
    { id: 'pedicure',       name: 'Pedicure',            price: 400,  duration: 40, emoji: '🦶' },
  ],

  // ---- Advance Booking Fee ----
  advanceBookingFee: 50, // ₹

  // ---- Offer Templates ----
  offers: {
    feedbackDiscount: '10% OFF on your next visit! 🎉',
    reactivation: '15% OFF this weekend — we miss you! 💈',
    referral: 'Refer a friend & both get 10% OFF! 🤝',
  },

  // ---- Reminder Lead Times (in ms) ----
  reminders: {
    twentyFourHours: 24 * 60 * 60 * 1000,
    twoHours: 2 * 60 * 60 * 1000,
  },

  // ---- Reactivation Window (days) ----
  reactivationDays: 30,

  // ---- Human Handoff Message ----
  humanHandoffMessage: 'Connecting you to our team.. Please hold on 🙏',
};

/**
 * Look up a service by ID or name (case-insensitive).
 */
salonConfig.findService = (query) => {
  const q = query.toLowerCase().trim();
  return salonConfig.services.find(
    (s) => s.id === q || s.name.toLowerCase() === q || s.name.toLowerCase().includes(q)
  );
};

/**
 * Format service list for WhatsApp.
 */
salonConfig.formatServiceList = () => {
  return salonConfig.services
    .map((s, i) => `${i + 1}. ${s.emoji} *${s.name}* — ₹${s.price}`)
    .join('\n');
};

module.exports = salonConfig;
