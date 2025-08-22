import axios from 'axios';
import { logger } from '../utils/logger';

interface LoopsContact {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  subscribed?: boolean;
  userGroup?: string;
  userId?: string;
  mailingLists?: Record<string, boolean>;
  [key: string]: any; // For custom properties
}

interface LoopsContactResponse {
  success: boolean;
  id?: string;
  message?: string;
}

interface LoopsEventProperties {
  [key: string]: string | number | boolean;
}

export class LoopsService {
  private apiKey: string;
  private baseUrl = 'https://app.loops.so/api/v1';

  constructor() {
    this.apiKey = process.env.LOOPS_API_KEY || '';
  }

  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT',
    endpoint: string,
    data?: any,
    params?: Record<string, string>
  ): Promise<any> {
    if (!this.apiKey) {
      logger.error('LOOPS_API_KEY is not set');
      return { success: false, message: 'LOOPS_API_KEY is not set' };
    }

    const url = `${this.baseUrl}/${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    try {
      logger.debug(`${method} ${endpoint}`);
      const response = await axios({
        method,
        url,
        headers,
        data,
        params,
      });

      return response.data;
    } catch (error: any) {
      logger.error(`Loops API error: ${method} ${endpoint} failed - ${error.message}`);
      if (error.response) {
        logger.error(`Response status: ${error.response.status}`);
        logger.error(`Response body: ${JSON.stringify(error.response.data)}`);
      }

      if (endpoint === 'contacts/find') {
        return [];
      } else if (endpoint === 'contacts/delete') {
        return { success: false, message: `Failed to delete: ${error.message}` };
      } else {
        return { success: false, message: `Operation failed: ${error.message}` };
      }
    }
  }

  async findContact(email?: string, userId?: string): Promise<LoopsContact | null> {
    if (!email && !userId) {
      throw new Error('Either email or userId must be provided');
    }
    if (email && userId) {
      throw new Error('Only one of email or userId should be provided');
    }

    const params: Record<string, string> = {};
    if (email) params.email = email;
    if (userId) params.userId = userId;

    logger.debug(`Finding contact with params:`, params);
    const response = await this.makeRequest('GET', 'contacts/find', undefined, params);
    const contacts = Array.isArray(response) ? response : [];
    return contacts.length > 0 ? contacts[0] : null;
  }

  async createContact(contactData: LoopsContact): Promise<LoopsContactResponse> {
    logger.debug(`Creating contact ${contactData.email}`);
    return this.makeRequest('POST', 'contacts/create', contactData);
  }

  async updateContact(contactData: LoopsContact): Promise<LoopsContactResponse> {
    logger.debug(`Updating contact ${contactData.email}`);
    return this.makeRequest('PUT', 'contacts/update', contactData);
  }

  async upsertContact(contactData: LoopsContact): Promise<LoopsContactResponse> {
    logger.debug(`Upserting contact ${contactData.email}`);
    
    const existingContact = await this.findContact(contactData.email);
    
    if (existingContact) {
      logger.debug(`Contact ${contactData.email} exists, updating`);
      return this.updateContact(contactData);
    }
    
    logger.debug(`Contact ${contactData.email} not found, creating`);
    return this.createContact(contactData);
  }

  async deleteContact(email: string, userId?: string): Promise<LoopsContactResponse> {
    logger.debug(`Attempting to delete contact ${email}`);
    
    const existingContact = await this.findContact(email);
    if (!existingContact) {
      logger.debug(`Contact ${email} not found, skipping delete`);
      return { success: true, message: 'Contact not found' };
    }

    logger.debug(`Deleting contact ${email}`);
    const payload: any = { email };
    if (userId) payload.userId = userId;
    
    return this.makeRequest('POST', 'contacts/delete', payload);
  }

  async sendEvent(
    email: string,
    eventName: string,
    userId?: string,
    eventProperties?: LoopsEventProperties,
    mailingLists?: Record<string, boolean>
  ): Promise<LoopsContactResponse> {
    logger.debug(`Sending event ${eventName} for ${email}`);
    if (eventProperties) {
      logger.debug(`With properties:`, eventProperties);
    }

    const payload: any = {
      email,
      eventName,
    };

    if (userId) payload.userId = userId;
    if (eventProperties) payload.eventProperties = eventProperties;
    if (mailingLists) payload.mailingLists = mailingLists;

    return this.makeRequest('POST', 'events/send', payload);
  }

  // Helper method for plus upgrade event
  async sendPlusUpgradeEvent(email: string, userId: string): Promise<LoopsContactResponse> {
    return this.sendEvent(email, 'plus_upgrade', userId);
  }

  // Helper method for welcome event
  async sendWelcomeEvent(email: string, userId: string): Promise<LoopsContactResponse> {
    return this.sendEvent(email, 'welcome', userId);
  }

  // Helper method to sync user data to Loops
  async syncUser(userData: {
    email: string;
    name?: string;
    username?: string;
    userId: string;
    planType?: string;
    createdAt?: Date;
  }): Promise<LoopsContactResponse> {
    const contactData: LoopsContact = {
      email: userData.email,
      firstName: userData.name || userData.username,
      userId: userData.userId,
      source: 'tracking.so',
      subscribed: true,
    };

    // Add custom properties
    if (userData.username) contactData.username = userData.username;
    if (userData.planType) contactData.planType = userData.planType;
    if (userData.createdAt) contactData.createdAt = userData.createdAt.toISOString();

    return this.upsertContact(contactData);
  }
}

export const loopsService = new LoopsService();