import twilio from 'twilio';
import { env } from '../config/env';

// Force development mode on Vercel to prevent timeouts
const forceDevMode = process.env.VERCEL || process.env.NODE_ENV === 'development';

export const sendOtp = async (phoneNumber: string, message: string): Promise<void> => {
  try {
    // Skip sending SMS on Vercel entirely
    if (forceDevMode) {
      console.log(`[SKIPPED SMS] Would send to ${phoneNumber}: ${message}`);
      return; // Exit immediately
    }
    
    // This code will never run on Vercel
    const client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    
    // Add a strict timeout to the Twilio call
    const twilioPromise = client.messages.create({
      body: message,
      from: env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    
    // Timeout after 5 seconds
    await Promise.race([
      twilioPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Twilio timeout')), 5000))
    ]);
  } catch (error) {
    console.error('SMS sending error:', error);
    // Don't throw - just log
  }
};