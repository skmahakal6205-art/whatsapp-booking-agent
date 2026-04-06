/**
 * ============================================
 * Intent Detector
 * ============================================
 * Detects user intent from free-text messages.
 */

const salonConfig = require('../config/salon');

const INTENT = {
  BOOK: 'BOOK',
  SERVICES: 'SERVICES',
  HUMAN: 'HUMAN',
  FEEDBACK_POSITIVE: 'FEEDBACK_POSITIVE',
  FEEDBACK_NEUTRAL: 'FEEDBACK_NEUTRAL',
  FEEDBACK_NEGATIVE: 'FEEDBACK_NEGATIVE',
  YES: 'YES',
  NO: 'NO',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Detect the intent of a user message.
 */
function detectIntent(message) {
  const msg = message.toLowerCase().trim();

  // ---- Number shortcuts ----
  if (msg === '1') return INTENT.BOOK;
  if (msg === '2') return INTENT.SERVICES;
  if (msg === '3') return INTENT.HUMAN;

  // ---- Yes/No ----
  const yesKeywords = ['yes', 'yeah', 'yep', 'sure', 'haan', 'ha', 'ji', 'ok', 'confirm', 'done'];
  const noKeywords = ['no', 'nah', 'nope', 'nahi', 'cancel', 'na', 'skip'];

  if (yesKeywords.some((kw) => msg === kw || msg.startsWith(kw + ' '))) return INTENT.YES;
  if (noKeywords.some((kw) => msg === kw || msg.startsWith(kw + ' '))) return INTENT.NO;

  // ---- Booking intent ----
  const bookKeywords = [
    'book', 'appointment', 'schedule', 'reserve', 'slot',
    'booking', 'appoint', 'fix', 'set', 'reserve',
    // Hinglish
    'book karo', 'appointment chahiye', 'slot chahiye',
    'book karna', 'appointment le', 'time fix', 'slot chahiye',
  ];
  if (bookKeywords.some((kw) => msg.includes(kw))) return INTENT.BOOK;

  // ---- Services intent ----
  const serviceKeywords = [
    'service', 'price', 'pricing', 'rate', 'menu',
    'list', 'offer', 'what do you', 'kya',
    // Hinglish
    'kya kya milta', 'service batao', 'price batao',
    'rate kya hai', 'kitna lagega', 'charges',
  ];
  if (serviceKeywords.some((kw) => msg.includes(kw))) return INTENT.SERVICES;

  // ---- Human handoff ----
  const humanKeywords = [
    'human', 'staff', 'person', 'talk to', 'call me',
    'manager', 'owner', 'help', 'agent',
    // Hinglish
    'kisi se baat', 'agent se baat', 'insaan', 'real person',
  ];
  if (humanKeywords.some((kw) => msg.includes(kw))) return INTENT.HUMAN;

  // ---- Feedback ----
  const positiveKeywords = ['loved', 'great', 'amazing', 'excellent', 'good', 'best', 'awesome', 'perfect', 'happy', 'satisfied', 'accha', 'bahut accha', 'maza aaya'];
  const neutralKeywords = ['okay', 'ok', 'fine', 'average', 'theek', 'thik'];
  const negativeKeywords = ['bad', 'terrible', 'worst', 'poor', 'not good', 'kharab', 'bekar', 'disappointed'];

  if (positiveKeywords.some((kw) => msg.includes(kw))) return INTENT.FEEDBACK_POSITIVE;
  if (negativeKeywords.some((kw) => msg.includes(kw))) return INTENT.FEEDBACK_NEGATIVE;
  if (neutralKeywords.some((kw) => msg.includes(kw))) return INTENT.FEEDBACK_NEUTRAL;

  // If the customer mentions a service, date, or time, treat it as booking intent.
  if (detectService(message) || detectDate(message) || detectTime(message)) {
    return INTENT.BOOK;
  }

  return INTENT.UNKNOWN;
}

/**
 * Try to match a service from user message.
 */
function detectService(message) {
  const msg = message.toLowerCase().trim();

  // Check if it's a number (menu selection)
  const num = parseInt(msg);
  if (!isNaN(num) && num >= 1 && num <= salonConfig.services.length) {
    return salonConfig.services[num - 1];
  }

  // Search by name
  return salonConfig.findService(msg);
}

/**
 * Try to detect a date from user message.
 */
function detectDate(message) {
  const msg = message.toLowerCase().trim();

  // Direct keywords
  if (msg === 'today' || msg === 'aaj') return 'today';
  if (msg === 'tomorrow' || msg === 'kal') return 'tomorrow';

  // "next Monday" etc
  const nextMatch = msg.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextMatch) return `next ${nextMatch[1]}`;

  // Date patterns: "5 april", "april 5", "5/4", "5-4-2026"
  const datePatterns = [
    /(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i,
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i,
    /(\d{1,2})[\/\-](\d{1,2})([\/\-](\d{2,4}))?/,
  ];

  for (const pattern of datePatterns) {
    const match = msg.match(pattern);
    if (match) return match[0];
  }

  return null;
}

/**
 * Try to detect a time from user message.
 */
function detectTime(message) {
  const msg = message.trim();

  // Match "2:00 PM", "2 pm", "14:30", "2:30pm"
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2}):(\d{2})/,
  ];

  for (const pattern of timePatterns) {
    const match = msg.match(pattern);
    if (match) return match[0];
  }

  return null;
}

function detectBookingDetails(message) {
  return {
    service: detectService(message),
    date: detectDate(message),
    time: detectTime(message),
  };
}

module.exports = {
  INTENT,
  detectIntent,
  detectService,
  detectDate,
  detectTime,
  detectBookingDetails,
};
