/**
 * ============================================
 * Session Manager — In-Memory Conversation State
 * ============================================
 * Tracks each user's position in the chatbot flow.
 * For production, swap this with Redis.
 */

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

class SessionManager {
  constructor() {
    /** @type {Map<string, object>} phone -> session */
    this.sessions = new Map();

    // Periodically clean up expired sessions
    setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  /**
   * Get or create a session for a phone number.
   */
  get(phone) {
    let session = this.sessions.get(phone);

    if (!session || this._isExpired(session)) {
      session = this._createNew(phone);
      this.sessions.set(phone, session);
    }

    session.lastActivity = Date.now();
    return session;
  }

  /**
   * Update session state.
   */
  update(phone, updates) {
    const session = this.get(phone);
    Object.assign(session, updates, { lastActivity: Date.now() });
    this.sessions.set(phone, session);
    return session;
  }

  /**
   * Reset a session to initial state.
   */
  reset(phone) {
    const session = this._createNew(phone);
    this.sessions.set(phone, session);
    return session;
  }

  /**
   * Delete a session.
   */
  delete(phone) {
    this.sessions.delete(phone);
  }

  /**
   * Get all active sessions (for debugging).
   */
  getAll() {
    const all = {};
    for (const [phone, session] of this.sessions) {
      all[phone] = { ...session };
    }
    return all;
  }

  // ---- Internal ----

  _createNew(phone) {
    return {
      phone,
      state: 'WELCOME', // Current chatbot state
      lastActivity: Date.now(),
      // Booking data
      customerName: null,
      profileName: null,
      serviceId: null,
      serviceName: null,
      servicePrice: null,
      serviceDuration: null,
      date: null,
      time: null,
      // Payment
      paymentLinkId: null,
      paymentLink: null,
      paymentAmount: null,
      // Meta
      bookingId: null,
      calendarEventId: null,
      crmContactId: null,
      isRepeatCustomer: false,
      // Feedback
      feedbackState: null,
      // Human handoff
      humanHandoff: false,
      // Retry counter for invalid inputs
      retryCount: 0,
    };
  }

  _isExpired(session) {
    return Date.now() - session.lastActivity > SESSION_TIMEOUT_MS;
  }

  _cleanup() {
    let cleaned = 0;
    for (const [phone, session] of this.sessions) {
      if (this._isExpired(session)) {
        this.sessions.delete(phone);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[Session] Cleaned up ${cleaned} expired sessions`);
    }
  }
}

module.exports = new SessionManager();
