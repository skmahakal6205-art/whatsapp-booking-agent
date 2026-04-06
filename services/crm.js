/**
 * ============================================
 * Bitrix24 CRM Service
 * ============================================
 * Contact creation, updates, and tagging.
 */

const axios = require('axios');

class CRMService {
  constructor() {
    this.baseUrl = process.env.BITRIX24_WEBHOOK_URL;
  }

  /**
   * Find an existing contact by phone number.
   * @returns {object|null} Contact or null
   */
  async findContactByPhone(phone) {
    try {
      const response = await axios.get(`${this.baseUrl}/crm.contact.list`, {
        params: {
          filter: { PHONE: phone },
          select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'UF_CRM_TAGS'],
        },
      });

      const contacts = response.data.result || [];
      return contacts.length > 0 ? contacts[0] : null;
    } catch (error) {
      console.error('[CRM] Contact lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Create a new contact in Bitrix24.
   */
  async createContact({ name, phone, service, appointmentDate }) {
    try {
      const [firstName, ...rest] = name.split(' ');
      const lastName = rest.join(' ') || '';

      const response = await axios.post(`${this.baseUrl}/crm.contact.add`, {
        fields: {
          NAME: firstName,
          LAST_NAME: lastName,
          PHONE: [{ VALUE: phone, VALUE_TYPE: 'MOBILE' }],
          COMMENTS: `Service: ${service}\nAppointment: ${appointmentDate}`,
          SOURCE_ID: 'WHATSAPP',
          UF_CRM_TAGS: 'New Customer',
        },
      });

      const contactId = response.data.result;
      console.log(`[CRM] Contact created: ${contactId}`);
      return contactId;
    } catch (error) {
      console.error('[CRM] Contact creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing contact with new appointment info.
   */
  async updateContact(contactId, { service, appointmentDate }) {
    try {
      await axios.post(`${this.baseUrl}/crm.contact.update`, {
        id: contactId,
        fields: {
          COMMENTS: `Latest Service: ${service}\nLatest Appointment: ${appointmentDate}`,
          UF_CRM_TAGS: 'Repeat Customer',
        },
      });

      console.log(`[CRM] Contact updated: ${contactId}`);
    } catch (error) {
      console.error('[CRM] Contact update failed:', error.message);
      throw error;
    }
  }

  /**
   * Create or update contact — auto-detects if new or returning.
   */
  async upsertContact({ name, phone, service, appointmentDate }) {
    const existing = await this.findContactByPhone(phone);

    if (existing) {
      await this.updateContact(existing.ID, { service, appointmentDate });
      return { contactId: existing.ID, isNew: false };
    } else {
      const contactId = await this.createContact({ name, phone, service, appointmentDate });
      return { contactId, isNew: true };
    }
  }

  /**
   * Create a deal/activity in CRM for tracking.
   */
  async createDeal({ contactId, name, service, price, appointmentDate }) {
    try {
      const response = await axios.post(`${this.baseUrl}/crm.deal.add`, {
        fields: {
          TITLE: `${service} — ${name}`,
          CONTACT_ID: contactId,
          OPPORTUNITY: price,
          CURRENCY_ID: 'INR',
          STAGE_ID: 'NEW',
          COMMENTS: `Service: ${service}\nDate: ${appointmentDate}`,
          SOURCE_ID: 'WHATSAPP',
        },
      });

      console.log(`[CRM] Deal created: ${response.data.result}`);
      return response.data.result;
    } catch (error) {
      console.error('[CRM] Deal creation failed:', error.message);
      throw error;
    }
  }

  /**
   * Get all contacts inactive for more than N days (for reactivation).
   */
  async getInactiveContacts(days = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const response = await axios.get(`${this.baseUrl}/crm.contact.list`, {
        params: {
          filter: {
            '<=DATE_MODIFY': cutoffDate.toISOString().split('T')[0],
          },
          select: ['ID', 'NAME', 'LAST_NAME', 'PHONE'],
        },
      });

      return response.data.result || [];
    } catch (error) {
      console.error('[CRM] Inactive contacts lookup failed:', error.message);
      return [];
    }
  }
}

module.exports = new CRMService();
