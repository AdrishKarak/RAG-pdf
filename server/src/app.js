import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { mkdirSync } from 'node:fs';
import { env } from './config/env.js';
import { healthCheck } from './api/health.js';
import { uploadPdf } from './api/upload.js';
import { handleChat } from './api/chat.js';

// Ensure the local upload directory is initialized
mkdirSync(env.UPLOAD_DIR, { recursive: true });

// Setup disk storage configuration for Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, env.UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ storage: storage });

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/', healthCheck);
app.post('/upload/pdf', upload.single('pdf'), uploadPdf);
app.get('/chat', handleChat);

// Start listening
app.listen(env.PORT, () => {
  console.log(`[Server] Express API is running on port: ${env.PORT}`);
});
