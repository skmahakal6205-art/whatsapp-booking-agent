/**
 * ============================================
 * Gemini AI Helper
 * ============================================
 * Optional Google Gemini / Vertex AI integration used to improve intent
 * recognition and booking extraction when customer messages are ambiguous.
 */

const axios = require('axios');

const PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const LOCATION = process.env.GOOGLE_API_LOCATION || 'us-central1';
const API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = process.env.GOOGLE_MODEL || 'gemini-1.5-pro';

function isEnabled() {
  return !!PROJECT_ID && !!API_KEY;
}

function getEndpoint() {
  if (!isEnabled()) {
    throw new Error('Gemini integration is not configured. Set GOOGLE_PROJECT_ID and GOOGLE_API_KEY.');
  }

  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL}:predict?key=${API_KEY}`;
}

function normalizePrediction(prediction) {
  if (prediction == null) return '';
  if (typeof prediction === 'string') return prediction;
  if (Array.isArray(prediction)) {
    return prediction.map(normalizePrediction).join('');
  }
  if (typeof prediction === 'object') {
    if ('text' in prediction) return String(prediction.text);
    if ('content' in prediction) return normalizePrediction(prediction.content);
  }
  return String(prediction);
}

function extractPredictionText(responseData) {
  if (!responseData) return '';

  if (Array.isArray(responseData.predictions)) {
    return responseData.predictions
      .map((prediction) => normalizePrediction(prediction.content || prediction))
      .join('\n')
      .trim();
  }

  if (responseData.prediction) {
    return normalizePrediction(responseData.prediction).trim();
  }

  return '';
}

async function requestGemini(prompt, temperature = 0.2, maxOutputTokens = 256) {
  const endpoint = getEndpoint();

  const response = await axios.post(
    endpoint,
    {
      instances: [
        {
          content: prompt,
        },
      ],
      parameters: {
        temperature,
        maxOutputTokens,
      },
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 20000,
    }
  );

  return extractPredictionText(response.data);
}

function findJsonBlock(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseJson(text) {
  const candidate = findJsonBlock(text) || text;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function normalizeIntent(intentValue) {
  if (!intentValue) return 'UNKNOWN';

  const normalized = String(intentValue).trim().toUpperCase();
  const map = {
    BOOKING: 'BOOK',
    APPOINTMENT: 'BOOK',
    SCHEDULE: 'BOOK',
    SERVICES: 'SERVICES',
    HUMAN: 'HUMAN',
    AGENT: 'HUMAN',
    YES: 'YES',
    NO: 'NO',
    POSITIVE: 'FEEDBACK_POSITIVE',
    NEGATIVE: 'FEEDBACK_NEGATIVE',
    NEUTRAL: 'FEEDBACK_NEUTRAL',
    UNKNOWN: 'UNKNOWN',
  };

  if (map[normalized]) return map[normalized];
  if (Object.values(map).includes(normalized)) return normalized;
  if (normalized.includes('BOOK') || normalized.includes('APPOINTMENT') || normalized.includes('SCHEDULE')) return 'BOOK';
  if (normalized.includes('SERVICE')) return 'SERVICES';
  if (normalized.includes('HUMAN') || normalized.includes('AGENT')) return 'HUMAN';
  if (normalized === 'YES' || normalized.startsWith('YES')) return 'YES';
  if (normalized === 'NO' || normalized.startsWith('NO')) return 'NO';

  return 'UNKNOWN';
}

async function parseBookingIntent(message) {
  if (!isEnabled()) {
    return {
      intent: 'UNKNOWN',
      service: null,
      date: null,
      time: null,
    };
  }

  const prompt = `You are a salon booking assistant. Read the customer's WhatsApp message and return only valid JSON with these keys: \n` +
    `intent, service, date, time.\n` +
    `- intent should be one of BOOK, SERVICES, HUMAN, YES, NO, FEEDBACK_POSITIVE, FEEDBACK_NEUTRAL, FEEDBACK_NEGATIVE, UNKNOWN.\n` +
    `- service should be the service name if the customer asks about a specific salon service or book one.\n` +
    `- date should be a natural date or calendar date if the message includes a booking date.\n` +
    `- time should be a sensible time string if the message includes a booking time.\n` +
    `Respond with only JSON and nothing else.\n` +
    `Message: \"${message.trim().replace(/\"/g, '\\"')}\"`;

  const raw = await requestGemini(prompt, 0.1, 256);
  const parsed = parseJson(raw);

  const intent = normalizeIntent(parsed?.intent);
  const service = parsed?.service ? String(parsed.service).trim() : null;
  const date = parsed?.date ? String(parsed.date).trim() : null;
  const time = parsed?.time ? String(parsed.time).trim() : null;

  return {
    intent: intent === 'UNKNOWN' && (service || date || time) ? 'BOOK' : intent,
    service: service || null,
    date: date || null,
    time: time || null,
    rawResponse: raw,
  };
}

module.exports = {
  isEnabled,
  parseBookingIntent,
};
