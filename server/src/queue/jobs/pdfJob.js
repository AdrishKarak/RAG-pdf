import { Queue, QueueEvents } from 'bullmq';
import { env } from '../../config/env.js';

const queueName = 'file-upload-queue';
const connection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
};

// Instantiate queue and events
export const pdfQueue = new Queue(queueName, { connection });
export const pdfQueueEvents = new QueueEvents(queueName, { connection });

/**
 * Adds a PDF indexing job to the BullMQ queue.
 * @param {object} file Multer file object
 * @returns {Promise<import('bullmq').Job>}
 */
export async function addPdfJob(file) {
  const jobData = {
    fieldname: file.fieldname,
    originalname: file.originalname,
    encoding: file.encoding,
    mimetype: file.mimetype,
    destination: file.destination,
    filename: file.filename,
    path: file.path,
    size: file.size,
  };

  // Add job to the queue
  const job = await pdfQueue.add(`index-pdf-${Date.now()}`, jobData, {
    removeOnComplete: true,
    removeOnFail: false,
  });

  return job;
}
