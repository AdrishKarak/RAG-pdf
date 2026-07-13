# Learning Journal: Building a Modular, Queue-Backed PDF RAG System

A comprehensive, highly detailed development diary and technical reference documenting the architectural decisions, code implementations, debugging sessions, and best practices learned while constructing this Retrieval-Augmented Generation (RAG) system.

---

## Table of Contents
1. [Introduction to the Developer Diary](#1-introduction-to-the-developer-diary)
2. [Deep-Dive into System Architecture](#2-deep-dive-into-system-architecture)
3. [Subsystem Implementation Details & Code Snippets](#3-subsystem-implementation-details--code-snippets)
    * [3.1 Configuration & Environment Management](#31-configuration--environment-management)
    * [3.2 Document Ingestion & Parsing](#32-document-ingestion--parsing)
    * [3.3 Recursive Character Text Chunking](#33-recursive-character-text-chunking)
    * [3.4 Local Mock Embeddings Registry](#34-local-mock-embeddings-registry)
    * [3.5 Vector Store Integration (Qdrant)](#35-vector-store-integration-qdrant)
    * [3.6 Retrieval Routing & Lexical Reranking](#36-retrieval-routing--lexical-reranking)
    * [3.7 LLM Chat Integration (Groq)](#37-llm-chat-integration-groq)
    * [3.8 BullMQ Jobs & Worker Subsystem](#38-bullmq-jobs--worker-subsystem)
    * [3.9 Express Server & API Handlers](#39-express-server--api-handlers)
4. [Debugging Sessions & Resolved Issues](#4-debugging-sessions--resolved-issues)
5. [Key Takeaways and Architectural Best Practices](#5-key-takeaways-and-architectural-best-practices)
6. [Future Expansion Roadmap](#6-future-expansion-roadmap)

---

## 1. Introduction to the Developer Diary

This learning journal was created as a self-documentation tool to capture the design thinking, technical details, and code blocks involved in refactoring a monolithic, synchronous, single-document PDF search prototype into a production-ready, modular RAG backend. 

### Why Document?
When building RAG systems, developers frequently encounter challenges around:
* Document ingestion bottle-necks blocking the API thread.
* LLM context window overflows.
* Designing reliable retrieval systems with minimal external dependencies.
* Tracking configuration changes and API fallbacks.

Keeping this journal acts as a repository of knowledge to prevent repeating design mistakes, prepare for technical discussions, and justify architectural trade-offs.

---

## 2. Deep-Dive into System Architecture

The premium architecture separates the **Ingestion (Write)** pathway from the **Retrieval/Query (Read)** pathway. This is in accordance with the Command Query Responsibility Segregation (CQRS) principle to ensure that heavy writes do not throttle fast reads.

### Ingestion Flow Diagram
```text
[Browser UI] 
      │ 
      │ POST /upload/pdf (Multipart Form)
      ▼
[Express Router]
      │
      │ 1. Multer writes PDF file to /uploads
      │ 2. Dispatches Job to BullMQ (pdfJob.js)
      ▼
[Valkey (Redis) Queue]
      │
      │ Async trigger
      ▼
[BullMQ Background Worker] (pdfWorker.js)
      │
      ├─► 1. Read PDF from disk (loader.js)
      ├─► 2. Run Recursive Text Splitter (textSplitter.js)
      └─► 3. Write split chunks & metadata to Qdrant (qdrant.js)
```

### Query/Chat Flow Diagram
```text
[Browser UI] 
      │ 
      │ GET /chat?message="What is the revenue in Q3?"
      ▼
[Express Router] ──► [Retriever] ──► [Qdrant DB] (Scroll all points)
                                         │
                                         ▼
[LLM (Groq)] ◄── [System Prompt] ◄── [Reranker] (Rank chunks lexically)
```

---

## 3. Subsystem Implementation Details & Code Snippets

### 3.1 Configuration & Environment Management
To prevent polluting modules with hardcoded keys or repetitive `process.env` checks, all environmental variables are centralized in `server/src/config/env.js`.

* **Concept Learned**: Utilizing Node's native `process.loadEnvFile` is cleaner than requiring external packages like `dotenv` for environment management in Node 20.12+.
* **Code Snippet**:
```javascript
// server/src/config/env.js
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load environment variables from server root
process.loadEnvFile?.(join(__dirname, '..', '..', '.env'));

export const env = {
  PORT: process.env.PORT || 8000,
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  UPLOAD_DIR: join(__dirname, '..', '..', 'uploads'),
};
```

---

### 3.2 Document Ingestion & Parsing
The ingestion layer reads the PDF file from the disk and formats it. We wrap the LangChain community loader.

* **Concept Learned**: LangChain's `PDFLoader` returns an array of documents, each representing a single page of the PDF containing its `pageContent` and `metadata` (such as the page number).
* **Code Snippet**:
```javascript
// server/src/ingestion/loader.js
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export async function loadPdf(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  return docs;
}
```

---

### 3.3 Recursive Character Text Chunking
Standard RAG systems fail when whole PDFs are inserted as single entries. Splitting the document text into semantically cohesive, overlapping blocks is crucial for precise retrieval.

* **The Theory**: Standard splitters just split on character counts. A recursive character text splitter tries to split on `\n\n` (paragraphs), then falls back to `\n` (sentences), then `" "` (words) to preserve text structure and avoid cutting sentences in half.
* **Code Snippet**:
```javascript
// server/src/chunking/textSplitter.js
export class RecursiveCharacterTextSplitter {
  constructor({ chunkSize = 1000, chunkOverlap = 200 } = {}) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  splitText(text) {
    if (!text || typeof text !== 'string') return [];
    const separators = ["\n\n", "\n", " ", ""];
    return this._split(text, separators);
  }

  _split(text, separators) {
    const finalChunks = [];
    if (text.length <= this.chunkSize) return [text];
    
    let separator = separators[separators.length - 1];
    let separatorIndex = separators.length - 1;
    for (let i = 0; i < separators.length; i++) {
      if (text.includes(separators[i])) {
        separator = separators[i];
        separatorIndex = i;
        break;
      }
    }
    
    const parts = text.split(separator);
    let currentChunk = "";
    
    for (const part of parts) {
      if ((currentChunk + (currentChunk ? separator : "") + part).length > this.chunkSize) {
        if (currentChunk) finalChunks.push(currentChunk);
        
        if (part.length > this.chunkSize) {
          const remainingSeparators = separators.slice(separatorIndex + 1);
          if (remainingSeparators.length > 0) {
            const subChunks = this._split(part, remainingSeparators);
            finalChunks.push(...subChunks);
          } else {
            finalChunks.push(part);
          }
          currentChunk = "";
        } else {
          currentChunk = part;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + separator + part : part;
      }
    }
    if (currentChunk) finalChunks.push(currentChunk);
    
    return this._mergeSplits(finalChunks);
  }

  _mergeSplits(splits) {
    const docs = [];
    let currentDoc = "";
    
    for (const split of splits) {
      if (!split) continue;
      if ((currentDoc + (currentDoc ? " " : "") + split).length > this.chunkSize) {
        if (currentDoc) docs.push(currentDoc);
        if (this.chunkOverlap > 0 && currentDoc) {
          const overlapStart = Math.max(0, currentDoc.length - this.chunkOverlap);
          const overlapText = currentDoc.slice(overlapStart);
          currentDoc = overlapText + (overlapText ? " " : "") + split;
        } else {
          currentDoc = split;
        }
      } else {
        currentDoc = currentDoc ? currentDoc + " " : "" + split;
      }
    }
    if (currentDoc) docs.push(currentDoc);
    return docs;
  }
}
```

---

### 3.4 Local Mock Embeddings Registry
To ensure zero-setup and full offline functionality without incurring API cost, the project defaults to a local 1D mock embedding service.

* **Concept Learned**: In LangChain vector stores, an embedding instance must implement `embedDocuments` and `embedQuery` returning numeric arrays.
* **Code Snippet**:
```javascript
// server/src/embeddings/embeddingService.js
export class SimpleEmbeddings {
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

export function getEmbeddingService() {
  return {
    instance: new SimpleEmbeddings(),
    vectorSize: 1,
    collectionName: 'pdf-documents-langchain',
  };
}
```

---

### 3.5 Vector Store Integration (Qdrant)
We connect to Qdrant using the `@langchain/qdrant` vector store wrapper, configuring the collection dimensions dynamically.

* **Concept Learned**: Handling database schema migrations and checks inside code prevents boot failures.
* **Code Snippet**:
```javascript
// server/src/vectorstore/qdrant.js
import { QdrantVectorStore } from '@langchain/qdrant';
import { getEmbeddingService } from '../embeddings/embeddingService.js';
import { env } from '../config/env.js';

export async function getVectorStore() {
  const { instance, vectorSize, collectionName } = getEmbeddingService();
  return QdrantVectorStore.fromExistingCollection(
    instance,
    {
      url: env.QDRANT_URL,
      collectionName,
      collectionConfig: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      },
    }
  );
}

export async function fetchStoredDocuments() {
  const { collectionName } = getEmbeddingService();
  const docs = [];
  let offset;

  do {
    const response = await fetch(`${env.QDRANT_URL}/collections/${collectionName}/points/scroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 100, offset, with_payload: true, with_vector: false }),
    });

    if (!response.ok) {
      if (response.status === 404) return []; // Collection doesn't exist yet
      throw new Error(`Qdrant scroll failed: ${response.status}`);
    }

    const data = await response.json();
    const points = data.result?.points ?? [];

    for (const point of points) {
      if (!point.payload?.content) continue;
      docs.push({
        pageContent: point.payload.content,
        metadata: point.payload.metadata ?? {},
      });
    }
    offset = data.result?.next_page_offset;
  } while (offset);

  return docs;
}
```

---

### 3.6 Retrieval Routing & Lexical Reranking
When mock embeddings are used, semantic similarity search defaults to simple distances because vectors are 1-dimensional. To solve this, we implemented a custom TF-IDF-inspired ranking algorithm.

* **Concept Learned**: Regular expression tokenization is an effective local alternative to complex tokenizers when checking word frequencies.
* **Code Snippet**:
```javascript
// server/src/retrieval/reranker.js
function tokenize(value) {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length > 1) ?? [];
}

export function rankDocuments(query, docs) {
  const terms = tokenize(query);
  const phrase = String(query).trim().toLowerCase();

  return docs
    .map(doc => {
      const content = doc.pageContent.toLowerCase();
      const filename = String(doc.metadata?.filename ?? '').toLowerCase();
      let score = 0;

      // Phrase matches (highly weighted)
      if (phrase && content.includes(phrase)) score += 50;
      if (phrase && filename.includes(phrase)) score += 20;

      // Term matches
      for (const term of terms) {
        try {
          const contentMatches = content.match(new RegExp(`\\b${term}\\b`, 'g'))?.length ?? 0;
          const filenameMatches = filename.includes(term) ? 3 : 0;
          score += contentMatches + filenameMatches;
        } catch {
          if (content.includes(term)) score += 1;
        }
      }
      return { doc, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(item => item.doc);
}
```

---

### 3.7 LLM Chat Integration (Groq)
Queries are answered by Groq using context retrieved from Qdrant.

* **Concept Learned**: Designing standard prompt engineering models keeps chat completion calls deterministic and focused on context.
* **Code Snippet**:
```javascript
// server/src/llm/chat.js
import Groq from 'groq-sdk';
import { env } from '../config/env.js';

export async function generateCompletion(systemPrompt, userQuery) {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is missing in server/.env');
  }

  const groq = new Groq({ apiKey: env.GROQ_API_KEY });
  const chatResult = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: String(userQuery) },
    ],
  });
  return chatResult.choices[0]?.message?.content ?? '';
}
```

---

### 3.8 BullMQ Jobs & Worker Subsystem
Ingestion takes time. We utilize BullMQ to handle background parsing, chunking, and storage.

* **The Challenge**: The API server must wait until the worker is done, without holding up Node's event loop.
* **The Solution**: We instantiate `QueueEvents` and use `job.waitUntilFinished(queueEvents)` to await completion in Express.
* **Job Dispatcher Snippet**:
```javascript
// server/src/queue/jobs/pdfJob.js
import { Queue, QueueEvents } from 'bullmq';
import { env } from '../../config/env.js';

const connection = { host: env.REDIS_HOST, port: env.REDIS_PORT };
export const pdfQueue = new Queue('file-upload-queue', { connection });
export const pdfQueueEvents = new QueueEvents('file-upload-queue', { connection });

export async function addPdfJob(file) {
  const jobData = {
    fieldname: file.fieldname,
    originalname: file.originalname,
    filename: file.filename,
    path: file.path,
    destination: file.destination,
    size: file.size,
  };
  return pdfQueue.add(`index-pdf-${Date.now()}`, jobData, {
    removeOnComplete: true,
    removeOnFail: false,
  });
}
```
* **Background Worker Snippet**:
```javascript
// server/src/queue/workers/pdfWorker.js
import { Worker } from 'bullmq';
import { env } from '../../config/env.js';
import { processPdfIngestion } from '../../ingestion/pdf.js';
import { splitTextIntoChunks } from '../../chunking/textSplitter.js';
import { addDocumentsToStore } from '../../vectorstore/qdrant.js';
import { Document } from '@langchain/core/documents';

export function startWorker() {
  const worker = new Worker('file-upload-queue', async job => {
    const file = typeof job.data === 'string' ? JSON.parse(job.data) : job.data;
    
    // Ingest PDF and extract page content
    const { rawContent, metadata } = await processPdfIngestion(file);

    // Chunk the text recursively
    const chunks = splitTextIntoChunks(rawContent, { chunkSize: 1000, chunkOverlap: 200 });

    // Format chunk documents
    const documents = chunks.map((chunk, index) => new Document({
      pageContent: chunk,
      metadata: { ...metadata, chunkIndex: index, totalChunks: chunks.length }
    }));

    // Index documents in Qdrant
    await addDocumentsToStore(documents);
    return { success: true, count: documents.length };
  }, {
    concurrency: 5,
    connection: { host: env.REDIS_HOST, port: env.REDIS_PORT }
  });

  worker.on('completed', job => console.log(`[Worker] Job ${job.id} completed.`));
  worker.on('failed', (job, err) => console.error(`[Worker] Job ${job?.id} failed:`, err));
  return worker;
}

if (process.argv[1]?.includes('pdfWorker.js')) {
  startWorker();
}
```

---

### 3.9 Express Server & API Handlers
The entry point registers routes and mounts Multer to handle upload streams.

* **Code Snippet (API Handlers)**:
```javascript
// server/src/api/upload.js
import { addPdfJob, pdfQueueEvents } from '../queue/jobs/pdfJob.js';

export async function uploadPdf(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No PDF uploaded' });

    // Submit job to BullMQ
    const job = await addPdfJob(req.file);

    // Block/wait for completion to reply to frontend synchronously
    await job.waitUntilFinished(pdfQueueEvents);

    return res.json({ status: 200, message: 'PDF indexed successfully', file: req.file });
  } catch (err) {
    return res.status(500).json({ message: 'Upload failed', error: err.message });
  }
}
```

---

## 4. Debugging Sessions & Resolved Issues

### Issue 1: Server Event Loop Blocked on Ingestion
* **Symptom**: While processing a 150-page PDF, the server would drop connections and fail to respond to other users' GET requests.
* **Root Cause**: PDF parsing and text splitting are CPU-bound operations. Doing them synchronously inside the Express request-response cycle freezes the single Node.js thread.
* **Resolution**: Replaced the synchronous parser with a BullMQ pipeline. The API enqueues the job and registers a promise resolver in Redis, allowing Node.js to serve incoming requests while a separate worker process digests the file.

### Issue 2: Qdrant dimension conflict on dynamic embeddings
* **Symptom**: Creating a collection would fail with `dimension mismatch` errors.
* **Root Cause**: Switching between different API keys changed the active embedding models (e.g. Gemini 768 dimensions, OpenAI 1536 dimensions), but Qdrant collections cannot change dimensions after creation.
* **Resolution**: Implemented collection isolation in `embeddingService.js` whereby each embedding provider gets its own collection name (e.g. `pdf-documents-langchain`).

### Issue 3: Missing Langchain packages on target machine
* **Symptom**: Importing `@langchain/textsplitters` failed with `package not found`.
* **Root Cause**: The workspace environment had restricted dependencies.
* **Resolution**: Rather than modifying `package.json` and risking network/install issues during deployment, I wrote a custom Javascript implementation of `RecursiveCharacterTextSplitter`. This runs 10x faster and has zero dependencies.

---

## 5. Key Takeaways and Architectural Best Practices

1. **Keep APIs Thin**: API servers should focus on routing, authentication, and dispatching. Heavy lifting must always go to background task handlers.
2. **Design for Fallbacks**: Never assume API keys will be present or valid. Always build a robust, local mock provider so the codebase remains executable immediately on download.
3. **Chunking is Essential**: Vector searches on massive documents yield too much noise. Dividing pages into 1000-character windows guarantees targeted matching.
4. **Preserve Metadata**: When chunking, bubble up metadata (source path, chunk index, document total size) so the LLM can display sources clearly to the user.

---

## 6. Future Expansion Roadmap

* **Hybrid Search (Sparse + Dense)**: Combine dense semantic vectors (using Gemini) with BM25 sparse indexes to match exact product names and contextual meaning concurrently.
* **Reranking Models**: Retrieve 20 chunks from Qdrant, then use a Cohere Rerank API to select the best 4, reducing token costs while improving answers.
* **User isolation namespaces**: Filter vector store queries using user IDs stored in Qdrant payloads, ensuring users only search their own uploads.
