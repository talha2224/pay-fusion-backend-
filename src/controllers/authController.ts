import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env as config } from '../config/env';
import { sendOtp } from '../services/twilioService';
import User from '../models/userModel';
import OTP, { IOTP } from '../models/otpModel';
import Device from '../models/deviceModel';

/**
 * Helper function to determine device type from user agent string
 */
function determineDeviceType(userAgent: string): string {
  console.log('Determining device type from user agent:', userAgent);
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) {
    return 'android';
  } else if (ua.includes('iphone') || ua.includes('ios')) {
    return 'ios';
  } else if (ua.includes('ipad') || ua.includes('tablet')) {
    return 'tablet';
  } else {
    return 'desktop';
  }
}

/**
 * Generate a random OTP code
 */
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Register a new user
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('Register request received:', req.body);
  try {
    const { firstName, lastName, email, phoneNumber, dateOfBirth, gender, receiveMessages, PIN, deviceId, deviceType: clientDeviceType } = req.body;
    
    // Check for deviceId first - this is critical for device verification later
    if (deviceId) {
      const existingDevice = await Device.findOne({ deviceId });
      if (existingDevice) {
        console.error('Registration failed: Device ID already exists');
        res.status(400).json({
          success: false,
          message: 'The user is present with this Device ID'
        });
        return;
      }
    }
    
    // Validate required fields
    if (!firstName || !lastName || !email || !phoneNumber || !dateOfBirth) {
      console.error('Registration failed: Missing required fields');
      res.status(400).json({
        success: false,
        message: 'Missing required fields. firstName, lastName, email, phoneNumber, and dateOfBirth are required.'
      });
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Registration failed: Invalid email format');
      res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
      return;
    }
    
    // Check if user already exists by phone number
    const existingUserByPhone = await User.findOne({ phoneNumber });
    if (existingUserByPhone) {
      console.error('Registration failed: Phone number already exists');
      res.status(400).json({
        success: false,
        message: 'User with this phone number already exists'
      });
      return;
    }
    
    // Check if user already exists by email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      console.error('Registration failed: Email already exists');
      res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
      return;
    }
    
    // Generate a unique account number
    const accountNumber = await generateUniqueAccountNumber();
    console.log('Generated account number:', accountNumber);
    
    console.log('Creating new user:', { firstName, lastName, email, phoneNumber, accountNumber });
    
    // Create a new user with account number
    const newUser = new User({
      firstName,
      lastName,
      email,
      phoneNumber,
      accountNumber,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      PIN: PIN || "000000", 
      messagesConsent: Boolean(receiveMessages)
    });
    
    await newUser.save();
    console.log('User created successfully with ID:', newUser._id);
    
    // Generate device ID if not provided
    const finalDeviceId = deviceId || `${newUser._id}-${Date.now()}`;
    
    // Register device
    const userAgent = req.headers['user-agent'] || '';
    
    // Use client-provided device type if available, otherwise detect from user agent
    const deviceType = clientDeviceType || determineDeviceType(userAgent);
    console.log('Device type:', deviceType);
    
    const device = new Device({
      userId: newUser._id,
      deviceId: finalDeviceId,
      deviceType,
      deviceInfo: userAgent,
      isVerified: false,
      lastLogin: new Date()
    });
    
    await device.save();
    console.log('Device registered with ID:', finalDeviceId, 'and type:', deviceType);
    
    // Generate and send OTP
    const otpCode = generateOTP();
    console.log('Generated OTP:', otpCode);
    
    // Save OTP to database with longer expiration
    const otp = new OTP({
      userId: newUser._id,
      phoneNumber,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    });
    
    await otp.save();
    console.log('OTP saved to database, expires at:', otp.expiresAt);
    
    // Send OTP via Twilio
    try {
      await sendOtp(phoneNumber, `Your PayFusion verification code is: ${otpCode}`);
      console.log('OTP sent successfully to:', phoneNumber);
    } catch (otpError: any) {
      console.error('Failed to send OTP:', otpError.message);
      // Continue with registration even if OTP sending fails
    }
    
    // Send account number information
    try {
      await sendOtp(phoneNumber, `Your PayFusion account has been created successfully. Your account number is: ${newUser.accountNumber}`);
      console.log('Account number sent successfully to:', phoneNumber);
    } catch (smsError: any) {
      console.error('Failed to send account number via SMS:', smsError.message);
      // Continue even if SMS sending fails
    }
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify OTP.',
      data: {
        userId: newUser._id,
        phoneNumber: newUser.phoneNumber,
        accountNumber: newUser.accountNumber,
        deviceId: finalDeviceId
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Improve error handling
    if (error.code === 11000) {
      // Handle duplicate key errors more gracefully
      const field = Object.keys(error.keyValue)[0];
      res.status(400).json({
        success: false,
        message: `User with this ${field} already exists`
      });
    } else {
      next(error);
    }
  }
};

/**
 * Generate a unique account number
 */
async function generateUniqueAccountNumber(): Promise<string> {
  const accountNumberLength = 10;
  let isUnique = false;
  let accountNumber = '';
  
  while (!isUnique) {
    // Generate a random 10-digit number
    accountNumber = Math.floor(Math.pow(10, accountNumberLength - 1) + 
                    Math.random() * 9 * Math.pow(10, accountNumberLength - 1))
                    .toString();
    
    // Check if this account number already exists
    const existingUser = await User.findOne({ accountNumber });
    if (!existingUser) {
      isUnique = true;
    }
  }
  
  return accountNumber;
}

/**
 * Verify OTP and complete registration
 */
export const verifyOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('OTP verification request received:', req.body);
  try {
    const { phoneNumber, otp, deviceId, deviceType: clientDeviceType } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !otp) {
      console.error('OTP verification failed: Missing required fields');
      res.status(400).json({
        success: false,
        message: 'Phone number and OTP are required'
      });
      return;
    }
    
    console.log('Looking for OTP record with phoneNumber:', phoneNumber, 'and OTP:', otp);
    
    // Find the OTP record
    const otpRecord = await OTP.findOne({ 
      phoneNumber, 
      otp,
      expiresAt: { $gt: new Date() }
    });
    
    if (!otpRecord) {
      console.error('OTP verification failed: Invalid or expired OTP');
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
      return;
    }
    
    console.log('OTP record found:', otpRecord);
    
    // Find and update user
    const user = await User.findById(otpRecord.userId);
    if (!user) {
      console.error('OTP verification failed: User not found');
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    console.log('User found:', user._id);
    
    user.isPhoneVerified = true;
    await user.save();
    console.log('User updated: isPhoneVerified set to true');
    
    // Delete the OTP record
    await OTP.deleteOne({ _id: otpRecord._id });
    console.log('OTP record deleted');
    
    // Create JWT token
    const token = jwt.sign(
      { id: user._id, phoneNumber: user.phoneNumber },
      config.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    console.log('JWT token created, expires in 30 days');
    
    // Find or update device with verified status
    if (deviceId) {
      const userAgent = req.headers['user-agent'] || '';
      // Use client-provided device type if available, otherwise detect from user agent
      const deviceType = clientDeviceType || determineDeviceType(userAgent);
      
      await Device.findOneAndUpdate(
        { deviceId, userId: user._id },
        { 
          isVerified: true, 
          lastLogin: new Date(),
          deviceType, // Make sure the device type is saved or updated
          deviceInfo: userAgent
        },
        { new: true, upsert: true }
      );
      console.log('Device verified:', deviceId, 'with type:', deviceType);
    } else {
      // Register device with required fields if no deviceId provided
      const userAgent = req.headers['user-agent'] || '';
      console.log('User agent:', userAgent);
      
      // Use client-provided device type if available, otherwise detect from user agent
      const deviceType = clientDeviceType || determineDeviceType(userAgent);
      console.log('Determined device type:', deviceType);
      
      const newDeviceId = `${user._id}-${Date.now()}`;
      console.log('Generated device ID:', newDeviceId);
      
      const device = new Device({
        userId: user._id,
        deviceId: newDeviceId,
        deviceType,
        deviceInfo: userAgent,
        isVerified: true,
        lastLogin: new Date()
      });
      
      try {
        await device.save();
        console.log('Device registered successfully:', newDeviceId);
      } catch (deviceError: any) {
        // Log device registration error but continue
        console.error('Failed to register device:', deviceError.message);
      }
    }
    
    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isPhoneVerified: user.isPhoneVerified,
          isOnboardingComplete: user.isOnboardingComplete
        }
      }
    });
  } catch (error: any) {
    console.error('OTP verification error:', error);
    next(error);
  }
};

/**
 * Resend OTP
 */
export const resendOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('Resend OTP request received:', req.body);
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      console.error('Resend OTP failed: Missing phone number');
      res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
      return;
    }
    
    // Find the user
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      console.error('Resend OTP failed: User not found');
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    console.log('User found:', user._id);
    
    // Delete any existing OTPs
    const deleteResult = await OTP.deleteMany({ userId: user._id });
    console.log('Deleted existing OTPs:', deleteResult.deletedCount);
    
    // Generate and send new OTP
    const otpCode = generateOTP();
    console.log('Generated new OTP:', otpCode);
    
    // Save OTP to database with longer expiration
    const otp = new OTP({
      userId: user._id,
      phoneNumber,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    });
    
    await otp.save();
    console.log('New OTP saved to database, expires at:', otp.expiresAt);
    
    // Send OTP via Twilio
    try {
      await sendOtp(phoneNumber, `Your PayFusion verification code is: ${otpCode}`);
      console.log('OTP sent successfully to:', phoneNumber);
    } catch (otpError: any) {
      console.error('Failed to send OTP:', otpError.message);
      // Continue even if OTP sending fails
    }
    
    res.json({
      success: true,
      message: 'OTP resent successfully'
    });
  } catch (error: any) {
    console.error('Resend OTP error:', error);
    next(error);
  }
};

/**
 * Login user
 */
/**
 * Login user
 */
/**
 * Login user
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('Login request received:', req.body);
  try {
    const { phoneNumber, deviceId, deviceType: clientDeviceType } = req.body;
    
    // Validate required fields
    if (!phoneNumber) {
      console.error('Login failed: Missing phone number');
      res.status(400).json({
        success: false,
        message: 'Phone number is required'
      });
      return;
    }
    
    // Check for device ID
    if (!deviceId) {
      console.error('Login Failed: DeviceID needed');
      res.status(400).json({
        success: false,
        message: 'DeviceID is required'
      });
      return;
    }
    
    // Find the user
    const user = await User.findOne({ phoneNumber });
    if (!user) {
      console.error('Login failed: User not found');
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    console.log('User found:', user._id);
    
    // Find all devices for this user
    const userDevices = await Device.find({ userId: user._id });
    console.log('User devices:', userDevices.map(d => ({ id: d.deviceId, type: d.deviceType })));
    
    // CHECK 1: Verify if the provided deviceId exists for this user
    const registeredDevice = userDevices.find(device => device.deviceId === deviceId);
    
    if (!registeredDevice) {
      console.error('Login failed: Device ID does not match registered device');
      res.status(400).json({
        success: false,
        message: 'Alert: Device change detected',
        errorCode: 'DEVICE_CHANGED',
        recoveryAction: 'VERIFY_ACCOUNT',
        recoveryMessage: 'Please verify your account number and PIN to continue'
      });
      return; // Exit early - no OTP will be sent
    }
    
    // CHECK 2: Ensure device type matches what was registered
    const userAgent = req.headers['user-agent'] || '';
    const detectedDeviceType = clientDeviceType || determineDeviceType(userAgent);
    
    if (registeredDevice.deviceType !== detectedDeviceType) {
      console.error(`Login failed: Device type mismatch. Registered: ${registeredDevice.deviceType}, Detected: ${detectedDeviceType}`);
      res.status(400).json({
        success: false,
        message: 'Alert: Device type has changed',
        errorCode: 'DEVICE_TYPE_CHANGED',
        recoveryAction: 'VERIFY_ACCOUNT',
        recoveryMessage: 'Please verify your account number and PIN to continue'
      });
      return; // Exit early - no OTP will be sent
    }
    
    // Only if device verification passes, continue with OTP generation and sending
    console.log('Device verification passed, proceeding with OTP generation');
    
    // Update device last login
    registeredDevice.lastLogin = new Date();
    await registeredDevice.save();
    console.log('Device login updated:', registeredDevice.deviceId);
    
    // Delete any existing OTPs
    const deleteResult = await OTP.deleteMany({ userId: user._id });
    console.log('Deleted existing OTPs:', deleteResult.deletedCount);
    
    // Generate OTP
    const otpCode = generateOTP();
    console.log('Generated login OTP:', otpCode);
    
    // Save OTP to database with longer expiration
    const otp = new OTP({
      userId: user._id,
      phoneNumber,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    });
    
    await otp.save();
    console.log('Login OTP saved to database, expires at:', otp.expiresAt);
    
    // Send OTP via Twilio
    try {
      await sendOtp(phoneNumber, `Your PayFusion login code is: ${otpCode}`);
      console.log('Login OTP sent successfully to:', phoneNumber);
    } catch (otpError: any) {
      console.error('Failed to send login OTP:', otpError.message);
      // Continue even if OTP sending fails
    }
    
    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        deviceId: registeredDevice.deviceId,
        deviceType: registeredDevice.deviceType
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    next(error);
  }
};

/**
 * Verify device change using account number and transaction PIN
 * Allows users to recover their account on a new device
 */
export const verifyDeviceChange = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('Device change verification request received:', req.body);
  try {
    const { accountNumber, PIN, phoneNumber, deviceId, deviceType: clientDeviceType } = req.body;
    
    // Validate required fields
    if (!accountNumber || !PIN || !phoneNumber) {
      console.error('Device change verification failed: Missing required fields');
      res.status(400).json({
        success: false,
        message: 'Account number, 6-digit PIN, and phone number are required'
      });
      return;
    }
    
    // Find the user by phone number and account number
    const user = await User.findOne({ 
      phoneNumber,
      accountNumber 
    }).select('+PIN +securityPIN');
    
    if (!user) {
      console.error('Device change verification failed: Invalid account details');
      res.status(400).json({
        success: false,
        message: 'Invalid account details. Please check and try again.'
      });
      return;
    }
    console.log('Stored PIN:', user.PIN);
    console.log('Stored securityPIN:', user.securityPIN);
    console.log('Provided PIN:', PIN);
    // Verify transaction PIN
    if (String(user.PIN) !== String(PIN) && String(user.securityPIN) !== String(PIN)) {
      console.error('Device change verification failed: Invalid transaction PIN');
      res.status(400).json({
        success: false,
        message: 'Invalid transaction PIN'
      });
      return;
    }
    
    console.log('User verified for device change:', user._id);
    
    // Generate OTP for additional verification
    const otpCode = generateOTP();
    console.log('Generated device change OTP:', otpCode);
    
    // Delete any existing OTPs
    await OTP.deleteMany({ userId: user._id });
    
    // Save OTP to database with longer expiration
    const otp = new OTP({
      userId: user._id,
      phoneNumber,
      otp: otpCode,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    });
    
    await otp.save();
    console.log('Device change OTP saved to database, expires at:', otp.expiresAt);
    
    // Register new device (but don't verify until OTP is confirmed)
    const userAgent = req.headers['user-agent'] || '';
    const deviceType = clientDeviceType || determineDeviceType(userAgent);
    const newDeviceId = deviceId || `${user._id}-${Date.now()}`;
    
    // Create or update device record
    const device = await Device.findOneAndUpdate(
      { deviceId: newDeviceId },
      {
        userId: user._id,
        deviceId: newDeviceId,
        deviceType,
        deviceInfo: userAgent,
        isVerified: false, // Will be set to true after OTP verification
        lastLogin: new Date()
      },
      { upsert: true, new: true }
    );
    
    // Send OTP via Twilio
    try {
      await sendOtp(phoneNumber, `Your PayFusion device verification code is: ${otpCode}`);
      console.log('Device change OTP sent successfully to:', phoneNumber);
    } catch (otpError: any) {
      console.error('Failed to send device change OTP:', otpError.message);
      // Continue even if OTP sending fails
    }
    
    res.status(200).json({
      success: true,
      message: 'Identity verified. Please verify your phone number with the OTP sent.',
      data: {
        userId: user._id,
        phoneNumber: user.phoneNumber,
        deviceId: newDeviceId,
        requireOtpVerification: true
      }
    });
    
  } catch (error: any) {
    console.error('Device change verification error:', error);
    next(error);
  }
};

/**
 * Verify OTP for device change and complete the process
 */
export const verifyDeviceChangeOTP = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  console.log('Device change OTP verification request received:', req.body);
  try {
    const { phoneNumber, otp, deviceId } = req.body;
    
    // Validate required fields
    if (!phoneNumber || !otp || !deviceId) {
      console.error('Device change OTP verification failed: Missing required fields');
      res.status(400).json({
        success: false,
        message: 'Phone number, OTP, and device ID are required'
      });
      return;
    }
    
    // Find the OTP record
    const otpRecord = await OTP.findOne({ 
      phoneNumber, 
      otp,
      expiresAt: { $gt: new Date() }
    });
    
    if (!otpRecord) {
      console.error('Device change OTP verification failed: Invalid or expired OTP');
      res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
      return;
    }
    
    // Find the user
    const user = await User.findById(otpRecord.userId);
    if (!user) {
      console.error('Device change OTP verification failed: User not found');
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }
    
    // Delete the OTP record
    await OTP.deleteOne({ _id: otpRecord._id });
    console.log('Device change OTP verified and deleted');
    
    // Verify the device
    const device = await Device.findOneAndUpdate(
      { deviceId, userId: user._id },
      { isVerified: true },
      { new: true }
    );
    
    if (!device) {
      console.error('Device verification failed: Device not found');
      res.status(404).json({
        success: false,
        message: 'Device not found'
      });
      return;
    }
    
    console.log('Device successfully verified:', device.deviceId);
    
    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, phoneNumber: user.phoneNumber },
      config.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    
    res.json({
      success: true,
      message: 'Device change completed successfully',
      data: {
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          isPhoneVerified: user.isPhoneVerified,
          isOnboardingComplete: user.isOnboardingComplete
        }
      }
    });
  } catch (error: any) {
    console.error('Device change OTP verification error:', error);
    next(error);
  }
};