import { Schema, model } from 'mongoose';

const deviceSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    deviceId: {
        type: String,
        required: true,
        unique: true
    },
    deviceType: {
        type: String,
        enum: ['mobile', 'desktop', 'tablet', 'android', 'ios'],
        required: true
    },
    deviceInfo: {
        type: String
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isVerified: {
        type: Boolean,  // Fixed: removed the trailing 'W'
        default: false
    }
}, { timestamps: true });

const Device = model('Device', deviceSchema);

export default Device;