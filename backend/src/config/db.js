/**
 * MongoDB connection.
 *
 * Purpose: open and close the Mongoose connection, and surface connection
 *          failures as process-level errors.
 * Inputs:  env.mongodbUri
 * Outputs: connect() / disconnect()
 * Deps:    mongoose, config/env
 */
import mongoose from 'mongoose';
import env from './env.js';
import logger from '../utils/logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase() {
  await mongoose.connect(env.mongodbUri);
  logger.info(`MongoDB connected: ${mongoose.connection.name}`);

  mongoose.connection.on('error', (error) => {
    logger.error('MongoDB connection error', error);
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

export default { connectDatabase, disconnectDatabase };
