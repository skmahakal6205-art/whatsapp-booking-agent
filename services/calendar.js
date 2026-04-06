/**
 * ============================================
 * Google Calendar Service
 * ============================================
 * Availability checking & event creation.
 */

const { google } = require('googleapis');

class CalendarService {
  constructor() {
    this.calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    this._auth = null;
    this._calendar = null;
  }

  // Lazy-init OAuth2 client
  _getAuth() {
    if (!this._auth) {
      this._auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      this._auth.setCredentials({
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      });
    }
    return this._auth;
  }

  _getCalendar() {
    if (!this._calendar) {
      this._calendar = google.calendar({ version: 'v3', auth: this._getAuth() });
    }
    return this._calendar;
  }

  /**
   * Generate auth URL for first-time setup.
   */
  getAuthUrl() {
    return this._getAuth().generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      prompt: 'consent',
    });
  }

  /**
   * Exchange auth code for tokens (first-time setup).
   */
  async getTokenFromCode(code) {
    const { tokens } = await this._getAuth().getToken(code);
    this._getAuth().setCredentials(tokens);
    return tokens;
  }

  /**
   * Check availability for a specific date & time.
   * Returns { available: boolean, alternatives: string[] }
   */
  async checkAvailability(dateStr, timeStr, durationMins = 30) {
    const calendar = this._getCalendar();

    const startTime = this._parseDateTime(dateStr, timeStr);
    const endTime = new Date(startTime.getTime() + durationMins * 60 * 1000);

    try {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: startTime.toISOString(),
          timeMax: endTime.toISOString(),
          items: [{ id: this.calendarId }],
        },
      });

      const busy = response.data.calendars[this.calendarId].busy || [];

      if (busy.length === 0) {
        return { available: true, startTime, endTime, alternatives: [] };
      }

      // Generate alternative slots
      const alternatives = await this._findAlternatives(dateStr, durationMins);
      return { available: false, alternatives };
    } catch (error) {
      console.error('[Calendar] Availability check failed:', error.message);
      // Fail-open: assume available if calendar API fails
      return { available: true, startTime, endTime, alternatives: [] };
    }
  }

  /**
   * Create a calendar event.
   */
  async createEvent(booking) {
    const calendar = this._getCalendar();

    const startTime = this._parseDateTime(booking.date, booking.time);
    const endTime = new Date(startTime.getTime() + (booking.duration || 30) * 60 * 1000);

    const event = {
      summary: `${booking.serviceName} — ${booking.customerName}`,
      description:
        `Customer: ${booking.customerName}\n` +
        `Phone: ${booking.phone}\n` +
        `Service: ${booking.serviceName}\n` +
        `Price: ₹${booking.price}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 120 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    try {
      const result = await calendar.events.insert({
        calendarId: this.calendarId,
        requestBody: event,
      });
      console.log(`[Calendar] Event created: ${result.data.id}`);
      return result.data;
    } catch (error) {
      console.error('[Calendar] Event creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Find available alternative slots on the same date.
   */
  async _findAlternatives(dateStr, durationMins) {
    const calendar = this._getCalendar();
    const salonConfig = require('../config/salon');

    const [openH, openM] = salonConfig.openTime.split(':').map(Number);
    const [closeH, closeM] = salonConfig.closeTime.split(':').map(Number);

    const dateBase = this._parseDate(dateStr);
    const dayStart = new Date(dateBase);
    dayStart.setHours(openH, openM, 0, 0);
    const dayEnd = new Date(dateBase);
    dayEnd.setHours(closeH, closeM, 0, 0);

    try {
      const response = await calendar.freebusy.query({
        requestBody: {
          timeMin: dayStart.toISOString(),
          timeMax: dayEnd.toISOString(),
          items: [{ id: this.calendarId }],
        },
      });

      const busy = response.data.calendars[this.calendarId].busy || [];
      const alternatives = [];
      let slotStart = new Date(dayStart);

      while (slotStart.getTime() + durationMins * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMins * 60 * 1000);

        const isConflict = busy.some((b) => {
          const bStart = new Date(b.start);
          const bEnd = new Date(b.end);
          return slotStart < bEnd && slotEnd > bStart;
        });

        if (!isConflict && slotStart > new Date()) {
          const timeStr = slotStart.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata',
          });
          alternatives.push(timeStr);
        }

        slotStart = new Date(slotStart.getTime() + salonConfig.slotDurationMins * 60 * 1000);

        if (alternatives.length >= 5) break;
      }

      return alternatives;
    } catch (error) {
      console.error('[Calendar] Alternative lookup failed:', error.message);
      return [];
    }
  }

  /**
   * Parse date string into Date object.
   */
  _parseDate(dateStr) {
    const lower = dateStr.toLowerCase().trim();
    const now = new Date();

    if (lower === 'today') return now;
    if (lower === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (lower.startsWith('next ')) {
      const dayName = lower.replace('next ', '');
      const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const targetDay = days.indexOf(dayName);
      if (targetDay >= 0) {
        const d = new Date(now);
        const diff = ((targetDay - d.getDay()) + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        return d;
      }
    }

    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      // Try adding current year
      const withYear = new Date(`${dateStr} ${now.getFullYear()}`);
      if (!isNaN(withYear.getTime())) return withYear;
      throw new Error(`Cannot parse date: ${dateStr}`);
    }
    return parsed;
  }

  /**
   * Parse date + time into Date object.
   */
  _parseDateTime(dateStr, timeStr) {
    const date = this._parseDate(dateStr);
    const time = this._parseTime(timeStr);
    date.setHours(time.hours, time.minutes, 0, 0);
    return date;
  }

  /**
   * Parse time string (e.g. "2:00 PM", "14:30") into { hours, minutes }.
   */
  _parseTime(timeStr) {
    const t = timeStr.trim();

    // 12-hour format
    const match12 = t.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i);
    if (match12) {
      let hours = parseInt(match12[1]);
      const minutes = parseInt(match12[2] || '0');
      const period = match12[3].toLowerCase();
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      return { hours, minutes };
    }

    // 24-hour format
    const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      return { hours: parseInt(match24[1]), minutes: parseInt(match24[2]) };
    }

    throw new Error(`Cannot parse time: ${timeStr}`);
  }
}

module.exports = new CalendarService();
