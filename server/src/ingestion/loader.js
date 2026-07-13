import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

/**
 * Loads a PDF file and extracts document pages using Langchain PDFLoader.
 * @param {string} filePath 
 * @returns {Promise<import('@langchain/core/documents').Document[]>}
 */
export async function loadPdf(filePath) {
  const loader = new PDFLoader(filePath);
  const docs = await loader.load();
  return docs;
}
