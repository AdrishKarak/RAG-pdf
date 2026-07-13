import { fetchStoredDocuments } from '../vectorstore/qdrant.js';
import { rankDocuments } from './reranker.js';

/**
 * Retrieves the most relevant document chunks matching the query.
 * Scrolls all stored chunks from Qdrant and ranks them lexically.
 * 
 * @param {string} query 
 * @param {number} [limit=4] 
 * @returns {Promise<Array<{ pageContent: string, metadata: object }>>}
 */
export async function retrieveRelevantDocs(query, limit = 4) {
  const storedDocs = await fetchStoredDocuments();
  return rankDocuments(query, storedDocs).slice(0, limit);
}
