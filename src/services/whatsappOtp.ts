import { auth, db } from '../firebase';
import {
  signInWithPhoneNumber,
  ConfirmationResult,
  RecaptchaVerifier,
} from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

let confirmationResult: ConfirmationResult | null = null;

/**
 * Send OTP to WhatsApp number via SMS
 */
export const sendOTP = async (phoneNumber: string): Promise<void> => {
  try {
    if (!phoneNumber.startsWith('+')) {
      throw new Error('Phone number must be in E.164 format (e.g., +919876543210)');
    }

    if (!(window as any).recaptchaVerifier) {
      throw new Error('reCAPTCHA not initialized');
    }

    console.log('📱 Sending OTP to:', phoneNumber);

    confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      (window as any).recaptchaVerifier
    );

    (window as any).confirmationResult = confirmationResult;

    console.log('✅ OTP sent successfully');
  } catch (error: any) {
    console.error('❌ Error sending OTP:', error);
    throw error;
  }
};


/**
 * Verify OTP entered by user
 */
export const verifyOTP = async (otp: string): Promise<string> => {
  try {
    // Use stored confirmation result
    const result = (window as any).confirmationResult || confirmationResult;
    
    if (!result) {
      throw new Error('No OTP sent. Please request OTP first.');
    }

    if (!/^\d{6}$/.test(otp)) {
      throw new Error('OTP must be a 6-digit number');
    }

    const credential = await result.confirm(otp);
    
    if (credential.user && credential.user.phoneNumber) {
      console.log('✅ Phone number verified:', credential.user.phoneNumber);
      confirmationResult = null;
      (window as any).confirmationResult = null;
      return credential.user.phoneNumber;
    }
    
    throw new Error('Verification failed');
  } catch (error: any) {
    console.error('❌ Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Save verified WhatsApp number to Firestore
 */
export const saveWhatsAppNumber = async (
  userId: string,
  phoneNumber: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      whatsappNumber: phoneNumber,
      whatsappVerified: true,
      whatsappVerifiedAt: new Date(),
    });
    console.log('✅ WhatsApp number saved to Firestore');
  } catch (error) {
    console.error('❌ Error saving WhatsApp number:', error);
    throw new Error('Failed to save WhatsApp number');
  }
};

/**
 * Format phone number to E.164 format
 */
export const formatPhoneNumber = (
  phoneNumber: string,
  countryCode: string = '+91'
): string => {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  if (cleanNumber.startsWith(countryCode.replace('+', ''))) {
    return `+${cleanNumber}`;
  }
  
  return `${countryCode}${cleanNumber}`;
};
