import mongoose, { Schema, Document } from 'mongoose';

// Update the interface to include balance
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: Date;
  securityPIN?: string;
  gender: 'Male' | 'Female' | 'Other';
  PIN: string;
  profilePicture?: string;
  utilityBill?: string;
  messagesConsent: boolean;
  isPhoneVerified: boolean;
  isOnboardingComplete: boolean;
  balance: number; // Added balance property
  accountNumber:string;
}

const userSchema = new Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    match: /.+\@.+\..+/,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    required: true,
  },
  PIN: {
    type: String,
    required: true,
    select: false // For security
  },
  profilePicture: {
    type: String,
  },
  utilityBill: {
    type: String,
  },
  messagesConsent: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isOnboardingComplete: {
    type: Boolean,
    default: false
  },
  balance: {
    type: Number,
    default: 0
  },
  accountNumber:{
    type: String,
    unique:true,
    sparse:true,
  },
  securityPIN: {
    type: String, 
    select: false // For security
  }
});

const User = mongoose.model<IUser>('User', userSchema);

export default User;