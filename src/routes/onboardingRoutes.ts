import { Router } from 'express';
import { createSecurityPin, createTransactionPin, uploadProfilePicture, uploadUtilityBill } from '../controllers/onboardingController';
import { authenticateToken } from '../middleware/auth';
import { RequestHandler } from 'express';

const router = Router();


// Create 4-digit transaction PIN
router.post('/transaction-pin', authenticateToken as RequestHandler, createTransactionPin as RequestHandler);

// Create 6-digit security PIN
router.post('/security-pin', authenticateToken as RequestHandler, createSecurityPin as RequestHandler);

// Upload profile picture
router.post('/profile-picture', authenticateToken as RequestHandler, uploadProfilePicture as RequestHandler);

// Upload utility bill
router.post('/utility-bill', authenticateToken as RequestHandler, uploadUtilityBill as RequestHandler);

export default router;