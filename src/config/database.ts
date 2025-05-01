import mongoose from 'mongoose';
import { env as config } from './env';

// Cache connection between function invocations
let cachedConnection: typeof mongoose | null = null;

export async function connectDB() {
  if (cachedConnection) {
    return cachedConnection;
  }

  mongoose.set('strictQuery', false);
  
  try {
    const conn = await mongoose.connect(config.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout for server selection
      connectTimeoutMS: 10000, // 10 seconds for connection
    });
    
    cachedConnection = conn;
    console.log('Database connected successfully');
    return conn;
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
}