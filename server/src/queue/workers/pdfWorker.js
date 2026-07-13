import { Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { processPdfIngestion } from '../../ingestion/pdf.js';
import { splitTextIntoChunks } from '../../chunking/textSplitter.js';
import { addDocumentsToStore } from '../../vectorstore/qdrant.js';
import { Document } from '@langchain/core/documents';

const queueName = 'file-upload-queue';

/**
 * Starts the BullMQ worker.
 * Connects to Valkyrie/Redis, receives upload jobs, processes them,
 * splits them into chunks, and indices them into the vector store.
 */
export function startWorker() {
  const worker = new Worker(queueName, async job => {
    const file = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
    console.log(`[Worker] Starting job ${job.id} for file: ${file.originalname}`);

    // 1. Ingest PDF
    const { rawContent, metadata } = await processPdfIngestion(file);

    // 2. Chunk text
    const chunks = splitTextIntoChunks(rawContent, { chunkSize: 1000, chunkOverlap: 200 });
    console.log(`[Worker] Split PDF into ${chunks.length} chunks`);

    // 3. Create Documents for each chunk
    const documents = chunks.map((chunk, index) => {
      return new Document({
        pageContent: chunk,
        metadata: {
          ...metadata,
          chunkIndex: index,
          totalChunks: chunks.length,
        }
      });
    });

    // 4. Save chunks to the active vector store collection
    await addDocumentsToStore(documents);
    console.log(`[Worker] Successfully indexed ${documents.length} chunks in vector store.`);
    return { success: true, count: documents.length };
  }, {
    concurrency: 5,
    connection: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
    }
  });

  worker.on('ready', () => {
    console.log('[Worker] Connected to Valkyrie and waiting for jobs...');
  });

  worker.on('completed', job => {
    console.log(`[Worker] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err);
  });

  worker.on('error', err => {
    console.error('[Worker] Worker connection error:', err);
  });

  return worker;
}

// Start worker immediately if this file is run directly
if (process.argv[1]?.includes('pdfWorker.js')) {
  startWorker();
}
