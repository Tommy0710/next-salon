import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    'Please define the MONGODB_URI environment variable inside .env.local'
  );
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // ── Optimized connection pool for production ───────────────────────────
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,          // Tối đa 10 connections song song
      minPoolSize: 2,           // Giữ sẵn ít nhất 2 connections
      serverSelectionTimeoutMS: 5000,  // Fail fast nếu không tìm được server
      socketTimeoutMS: 45000,   // Timeout sau 45s không hoạt động
      connectTimeoutMS: 10000,  // Timeout khi connect lần đầu
    };

    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ MongoDB connected');
    }
  } catch (e: any) {
    cached.promise = null;
    console.error('❌ MongoDB connection failed:', e.message);
    throw e;
  }

  return cached.conn;
}

export const connectToDB = dbConnect;
export default dbConnect;
