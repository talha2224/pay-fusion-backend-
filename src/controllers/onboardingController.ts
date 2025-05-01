import { Response } from 'express';
import { AuthenticatedRequest } from '../types/authenticatedRequest';
import User from '../models/userModel';

/**
 * Set and confirm transaction PIN
 */
/**
 * Create a 4-digit transaction PIN
 */
export const createTransactionPin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { transactionPin } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    // Validate PIN - must be exactly 4 digits
    if (!transactionPin || !/^\d{4}$/.test(transactionPin)) {
      res.status(400).json({
        success: false,
        message: 'Transaction PIN must be exactly 4 digits'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // In a real implementation, you should hash the PIN before saving
    user.PIN = transactionPin;
    
    // Check if this completes onboarding
    if (user.profilePicture && user.utilityBill) {
      user.isOnboardingComplete = true;
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Transaction PIN created successfully',
      data: {
        isOnboardingComplete: user.isOnboardingComplete
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create transaction PIN',
      error: error.message
    });
  }
};

/**
 * Create a 6-digit security PIN
 */
export const createSecurityPin = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { securityPin } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    // Validate PIN - must be exactly 6 digits
    if (!securityPin || !/^\d{6}$/.test(securityPin)) {
      res.status(400).json({
        success: false,
        message: 'Security PIN must be exactly 6 digits'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // In a real implementation, you should hash the PIN before saving
    user.securityPIN = securityPin;
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Security PIN created successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create security PIN',
      error: error.message
    });
  }
};

/**
 * Upload user profile picture
 */
export const uploadProfilePicture = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // In a real implementation, req.file would contain the uploaded file info
    const profilePictureUrl = req.file?.path || req.body.profilePictureUrl;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (!profilePictureUrl) {
      res.status(400).json({
        success: false,
        message: 'No profile picture provided'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    user.profilePicture = profilePictureUrl;
    
    // Check if this completes onboarding
    if (user.PIN && user.utilityBill) {
      user.isOnboardingComplete = true;
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      data: {
        profilePicture: user.profilePicture,
        isOnboardingComplete: user.isOnboardingComplete
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture',
      error: error.message
    });
  }
};

/**
 * Upload utility bill for address verification
 */
export const uploadUtilityBill = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const utilityBillUrl = req.file?.path || req.body.utilityBillUrl;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
      return;
    }

    if (!utilityBillUrl) {
      res.status(400).json({
        success: false,
        message: 'No utility bill provided'
      });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    user.utilityBill = utilityBillUrl;
    
    // Check if this completes onboarding
    if (user.PIN && user.profilePicture) {
      user.isOnboardingComplete = true;
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Utility bill uploaded successfully',
      data: {
        utilityBill: user.utilityBill,
        isOnboardingComplete: user.isOnboardingComplete
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to upload utility bill',
      error: error.message
    });
  }
};

