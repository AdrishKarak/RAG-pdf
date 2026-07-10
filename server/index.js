import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { Document } from '@langchain/core/documents';
import { QdrantVectorStore } from '@langchain/qdrant';
import Groq from 'groq-sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = join(__dirname, 'uploads');
const QDRANT_URL = 'http://localhost:6333';
const COLLECTION_NAME = 'pdf-documents-langchain';

process.loadEnvFile?.(join(__dirname, '.env'));
mkdirSync(UPLOAD_DIR, { recursive: true });

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

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

function getVectorStore() {
  return QdrantVectorStore.fromExistingCollection(
    new SimpleEmbeddings(),
    {
      url: QDRANT_URL,
      collectionName: COLLECTION_NAME,
      collectionConfig: {
        vectors: {
          size: 1,
          distance: 'Cosine',
        },
      },
    }
  );
}

async function buildPdfDocument(file) {
  const loader = new PDFLoader(file.path);
  const docs = await loader.load();

  return new Document({
    pageContent: docs.map(doc => doc.pageContent).join('\n\n'),
    metadata: {
      filename: file.originalname,
      path: file.path,
      destination: file.destination,
      pages: docs.map(doc => doc.metadata),
    },
  });
}

async function indexPdf(file) {
  const vectorStore = await getVectorStore();
  const document = await buildPdfDocument(file);

  await vectorStore.addDocuments([document]);
  return document;
}

function tokenize(value) {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length > 1) ?? [];
}

function rankDocuments(query, docs) {
  const terms = tokenize(query);
  const phrase = String(query).trim().toLowerCase();

  return docs
    .map(doc => {
      const content = doc.pageContent.toLowerCase();
      const filename = String(doc.metadata?.filename ?? '').toLowerCase();
      let score = 0;

      if (phrase && content.includes(phrase)) score += 50;
      if (phrase && filename.includes(phrase)) score += 20;

      for (const term of terms) {
        const contentMatches = content.match(new RegExp(`\\b${term}\\b`, 'g'))?.length ?? 0;
        const filenameMatches = filename.includes(term) ? 3 : 0;
        score += contentMatches + filenameMatches;
      }

      return { doc, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.doc.metadata?.path ?? '').localeCompare(String(a.doc.metadata?.path ?? ''));
    })
    .map(item => item.doc);
}

async function fetchStoredDocuments() {
  const docs = [];
  let offset;

  do {
    const response = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        limit: 100,
        offset,
        with_payload: true,
        with_vector: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Qdrant scroll failed with ${response.status}`);
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

function buildContext(docs) {
  const maxChars = 20000;
  let used = 0;

  return docs
    .map(doc => {
      const remaining = maxChars - used;
      if (remaining <= 0) return '';

      const filename = doc.metadata?.filename ?? 'PDF source';
      const content = doc.pageContent.slice(0, remaining);
      used += content.length;
      return `Source: ${filename}\n${content}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  return res.json({ status: 200, message: 'Hello from the server' });
});

app.post('/upload/pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    await indexPdf(req.file);

    return res.json({ status: 200, message: 'PDF uploaded and indexed successfully', file: req.file });
  } catch (err) {
    console.error('Upload failed', err);
    return res.status(500).json({ message: 'Upload failed' });
  }
});

app.get('/chat', async (req, res) => {
  try {
    const userQuery = req.query.message;

    if (!userQuery) {
      return res.status(400).json({ message: 'message query param is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ message: 'GROQ_API_KEY is missing in server/.env' });
    }

    const storedDocs = await fetchStoredDocuments();
    const result = rankDocuments(userQuery, storedDocs).slice(0, 4);
    const context = buildContext(result);

    const chatResult = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `Answer the user using only this PDF context. If the answer is not in the context, say you do not know.\n\nContext:\n${context}`,
        },
        { role: 'user', content: String(userQuery) },
      ],
    });

    return res.json({
      message: chatResult.choices[0]?.message?.content,
      docs: result,
    });
  } catch (err) {
    console.error('Chat failed', err);
    return res.status(500).json({ message: 'Chat failed' });
  }
});

app.listen(8000, () => console.log(`Server is running on PORT: ${8000}`));
