/**
 * ============================================
 * Booking Store — In-Memory Booking Database
 * ============================================
 * For production, replace with a real database.
 */

const { v4: uuidv4 } = require('uuid');

class BookingStore {
  constructor() {
    /** @type {Map<string, object>} bookingId -> booking */
    this.bookings = new Map();
    /** @type {Map<string, string[]>} phone -> bookingIds */
    this.phoneIndex = new Map();
  }

  /**
   * Create a new booking.
   */
  create(data) {
    const booking = {
      id: uuidv4(),
      phone: data.phone,
      customerName: data.customerName,
      serviceId: data.serviceId,
      serviceName: data.serviceName,
      price: data.price,
      duration: data.duration,
      date: data.date,
      time: data.time,
      status: 'pending_payment', // pending_payment | confirmed | completed | cancelled
      paymentStatus: 'pending', // pending | paid | failed
      paymentLinkId: null,
      calendarEventId: null,
      crmContactId: null,
      crmDealId: null,
      feedbackReceived: false,
      feedbackScore: null,
      referralSent: false,
      remindersSent: {
        twentyFourHour: false,
        twoHour: false,
      },
      followUpSent: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.bookings.set(booking.id, booking);

    // Update phone index
    const existing = this.phoneIndex.get(data.phone) || [];
    existing.push(booking.id);
    this.phoneIndex.set(data.phone, existing);

    console.log(`[Booking] Created: ${booking.id} for ${data.customerName}`);
    return booking;
  }

  /**
   * Get a booking by ID.
   */
  get(bookingId) {
    return this.bookings.get(bookingId) || null;
  }

  /**
   * Update a booking.
   */
  update(bookingId, updates) {
    const booking = this.bookings.get(bookingId);
    if (!booking) return null;

    Object.assign(booking, updates, { updatedAt: new Date().toISOString() });
    this.bookings.set(bookingId, booking);
    return booking;
  }

  /**
   * Get all bookings for a phone number.
   */
  getByPhone(phone) {
    const ids = this.phoneIndex.get(phone) || [];
    return ids.map((id) => this.bookings.get(id)).filter(Boolean);
  }

  /**
   * Get the customer's most recent booking.
   */
  getLatest(phone) {
    const bookings = this.getByPhone(phone);
    if (bookings.length === 0) return null;
    return bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }

  /**
   * Check if customer has had previous bookings (for repeat detection).
   */
  isRepeatCustomer(phone) {
    const bookings = this.getByPhone(phone);
    return bookings.filter((b) => b.status === 'confirmed' || b.status === 'completed').length > 0;
  }

  /**
   * Get all bookings that need reminders.
   */
  getUpcomingBookings() {
    const now = Date.now();
    const results = [];

    for (const [, booking] of this.bookings) {
      if (booking.status !== 'confirmed') continue;

      try {
        const appointmentTime = new Date(`${booking.date} ${booking.time}`).getTime();
        if (isNaN(appointmentTime)) continue;

        const timeUntil = appointmentTime - now;

        // 24-hour reminder window (23h-25h before)
        if (
          !booking.remindersSent.twentyFourHour &&
          timeUntil > 23 * 60 * 60 * 1000 &&
          timeUntil < 25 * 60 * 60 * 1000
        ) {
          results.push({ booking, type: '24h' });
        }

        // 2-hour reminder window (1.5h-2.5h before)
        if (
          !booking.remindersSent.twoHour &&
          timeUntil > 90 * 60 * 1000 &&
          timeUntil < 150 * 60 * 1000
        ) {
          results.push({ booking, type: '2h' });
        }

        // Follow-up window (1.5h-2.5h after)
        if (
          !booking.followUpSent &&
          timeUntil < -90 * 60 * 1000 &&
          timeUntil > -150 * 60 * 1000
        ) {
          results.push({ booking, type: 'followup' });
        }
      } catch (e) {
        // Skip bookings with unparseable dates
      }
    }

    return results;
  }

  /**
   * Get all pending payment bookings (for payment reminders).
   */
  getPendingPayments() {
    const now = Date.now();
    const results = [];

    for (const [, booking] of this.bookings) {
      if (booking.status !== 'pending_payment') continue;
      if (!booking.paymentLinkId) continue;

      const createdAt = new Date(booking.createdAt).getTime();
      const elapsed = now - createdAt;

      // Send reminder after 30 minutes
      if (elapsed > 30 * 60 * 1000 && elapsed < 35 * 60 * 1000) {
        results.push(booking);
      }
    }

    return results;
  }

  /**
   * Get all bookings (for admin dashboard).
   */
  getAll() {
    return Array.from(this.bookings.values());
  }

  /**
   * Get booking statistics.
   */
  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      confirmed: all.filter((b) => b.status === 'confirmed').length,
      completed: all.filter((b) => b.status === 'completed').length,
      cancelled: all.filter((b) => b.status === 'cancelled').length,
      pendingPayment: all.filter((b) => b.status === 'pending_payment').length,
      totalRevenue: all
        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + (b.price || 0), 0),
    };
  }
}

module.exports = new BookingStore();
