import { Schema, model } from 'mongoose';

const walletSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    balance: {
        type: Number,
        default: 0
    },
    transactions: [{
        type: Schema.Types.ObjectId,
        ref: 'Transaction'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },// Add this field to your User schema
    accountNumber: {
      type: String,
      unique: true,
      sparse: true // Allows null values but still maintains uniqueness for non-null values
    }

});

walletSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const Wallet = model('Wallet', walletSchema);

export default Wallet;