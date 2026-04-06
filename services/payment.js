/**
 * ============================================
 * Payment Service (Razorpay)
 * ============================================
 * Generate payment links and verify payments.
 */

const axios = require('axios');

class PaymentService {
  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.baseUrl = 'https://api.razorpay.com/v1';
  }

  _getAuth() {
    return {
      username: this.keyId,
      password: this.keySecret,
    };
  }

  /**
   * Create a Razorpay payment link.
   * @returns {{ shortUrl: string, id: string }}
   */
  async createPaymentLink({ amount, customerName, phone, description, bookingId }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/payment_links`,
        {
          amount: amount * 100, // Razorpay uses paise
          currency: 'INR',
          description: description || 'Salon Booking Advance',
          customer: {
            name: customerName,
            contact: phone,
          },
          notify: {
            sms: false,
            email: false,
          },
          callback_url: `${process.env.BASE_URL}/api/payment/callback`,
          callback_method: 'get',
          notes: {
            bookingId: bookingId,
            customerName: customerName,
            phone: phone,
          },
          reminder_enable: false,
          expire_by: Math.floor(Date.now() / 1000) + 86400, // 24 hours
        },
        { auth: this._getAuth() }
      );

      console.log(`[Payment] Link created: ${response.data.short_url}`);
      return {
        id: response.data.id,
        shortUrl: response.data.short_url,
        amount: amount,
      };
    } catch (error) {
      console.error('[Payment] Link creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Check payment status by payment link ID.
   * @returns {{ paid: boolean, amount: number }}
   */
  async checkPaymentStatus(paymentLinkId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/payment_links/${paymentLinkId}`,
        { auth: this._getAuth() }
      );

      return {
        paid: response.data.status === 'paid',
        amount: response.data.amount_paid / 100,
        status: response.data.status,
      };
    } catch (error) {
      console.error('[Payment] Status check failed:', error.message);
      return { paid: false, amount: 0, status: 'error' };
    }
  }
}

module.exports = new PaymentService();
