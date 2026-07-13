import { loadPdf } from './loader.js';

/**
 * Ingests a PDF file, loads its content, and prepares a structured output.
 * @param {object} file Multer file object
 * @returns {Promise<{ rawContent: string, metadata: object }>}
 */
export async function processPdfIngestion(file) {
  const docs = await loadPdf(file.path);
  
  return {
    rawContent: docs.map(doc => doc.pageContent).join('\n\n'),
    metadata: {
      filename: file.originalname,
      path: file.path,
      destination: file.destination,
      pages: docs.map(doc => doc.metadata),
    }
  };
}
