/**
 * ============================================
 * WhatsApp Provider — Abstraction Layer
 * ============================================
 * Supports WATI and Twilio. Switch via WHATSAPP_PROVIDER env.
 */

const axios = require('axios');
const twilio = require('twilio');

class WhatsAppProvider {
  constructor() {
    this.provider = process.env.WHATSAPP_PROVIDER || 'wati';
    if (this.provider === 'twilio') {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }
  }

  /**
   * Send a text message to a WhatsApp number.
   * @param {string} to — Phone number with country code (e.g. +919876543210)
   * @param {string} message — Text body
   */
  async sendMessage(to, message) {
    try {
      if (this.provider === 'twilio') {
        return await this._sendViaTwilio(to, message);
      } else {
        return await this._sendViaWati(to, message);
      }
    } catch (error) {
      console.error(`[WhatsApp] Failed to send message to ${to}:`, error.message);
      throw error;
    }
  }

  // ---- WATI ----
  async _sendViaWati(to, message) {
    const phone = to.replace('+', '');
    const url = `${process.env.WATI_API_URL}/api/v1/sendSessionMessage/${phone}`;

    const response = await axios.post(
      url,
      { messageText: message },
      {
        headers: {
          Authorization: `Bearer ${process.env.WATI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // If session expired, try template message
    if (response.data && response.data.result === false) {
      console.log(`[WATI] Session expired for ${phone}, attempting template message...`);
      return await this._sendWatiTemplate(phone, message);
    }

    console.log(`[WATI] Message sent to ${phone}`);
    return response.data;
  }

  async _sendWatiTemplate(phone, message) {
    const url = `${process.env.WATI_API_URL}/api/v1/sendTemplateMessage/${phone}`;

    const response = await axios.post(
      url,
      {
        template_name: 'salon_notification',
        broadcast_name: 'auto_notification',
        parameters: [{ name: 'body', value: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WATI_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[WATI] Template message sent to ${phone}`);
    return response.data;
  }

  // ---- Twilio ----
  async _sendViaTwilio(to, message) {
    const twilioTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const result = await this.twilioClient.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: twilioTo,
      body: message,
    });

    console.log(`[Twilio] Message sent to ${to} — SID: ${result.sid}`);
    return result;
  }

  /**
   * Parse incoming webhook payload into a standard format.
   */
  parseIncoming(req) {
    if (this.provider === 'twilio') {
      return {
        from: (req.body.From || '').replace('whatsapp:', ''),
        message: req.body.Body || '',
        profileName: req.body.ProfileName || '',
        messageId: req.body.MessageSid || '',
      };
    } else {
      // WATI webhook payload
      const data = req.body;
      return {
        from: data.waId ? `+${data.waId}` : '',
        message: data.text || '',
        profileName: data.senderName || data.pushName || '',
        messageId: data.id || '',
      };
    }
  }
}

module.exports = new WhatsAppProvider();
