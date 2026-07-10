import { Worker } from 'bullmq';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Document } from '@langchain/core/documents';
import { QdrantVectorStore } from '@langchain/qdrant';

const __dirname = dirname(fileURLToPath(import.meta.url));

process.loadEnvFile?.(join(__dirname, '.env'));

class SimpleEmbeddings {
  async embedDocuments(texts) {
    return texts.map(text => this.embedText(text));
  }

  async embedQuery(text) {
    return this.embedText(text);
  }

  embedText(text) {
    return [text.length || 1];
  }
}

const worker = new Worker('file-upload-queue', async job => {
    const data = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
    console.log(data);

    // Load the PDF file using PDFLoader
    const loader = new PDFLoader(data.path);
    const docs = await loader.load();

    const fullDocument = new Document({
      pageContent: docs.map(doc => doc.pageContent).join('\n\n'),
      metadata: {
        filename: data.filename,
        path: data.path,
        destination: data.destination,
        pages: docs.map(doc => doc.metadata),
      },
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      new SimpleEmbeddings(),
      {
        url: 'http://localhost:6333',
        collectionName: 'pdf-documents-langchain',
        collectionConfig: {
          vectors: {
            size: 1,
            distance: 'Cosine',
          },
        },
      }
    );

    await vectorStore.addDocuments([fullDocument]);

}, { concurrency: 100 , connection: {
    host: 'localhost',
    port: 6379
} });

worker.on('ready', () => {
    console.log('Worker connected to Valkyrie and is waiting for jobs');
});

worker.on('completed', job => {
    console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed`, err);
});

worker.on('error', err => {
    console.error('Worker error', err);
});
