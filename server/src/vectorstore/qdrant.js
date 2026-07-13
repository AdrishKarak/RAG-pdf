import { QdrantVectorStore } from '@langchain/qdrant';
import { getEmbeddingService } from '../embeddings/embeddingService.js';
import { env } from '../config/env.js';

/**
 * Instantiates and returns the Langchain QdrantVectorStore wrapper.
 * Automatically handles collection naming and vector dimension based on the active embedding provider.
 * @returns {Promise<QdrantVectorStore>}
 */
export async function getVectorStore() {
  const { instance, vectorSize, collectionName } = getEmbeddingService();
  
  return QdrantVectorStore.fromExistingCollection(
    instance,
    {
      url: env.QDRANT_URL,
      collectionName: collectionName,
      collectionConfig: {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      },
    }
  );
}

/**
 * Adds an array of Langchain Document objects to the active Qdrant collection.
 * @param {import('@langchain/core/documents').Document[]} documents 
 * @returns {Promise<void>}
 */
export async function addDocumentsToStore(documents) {
  const vectorStore = await getVectorStore();
  await vectorStore.addDocuments(documents);
}

/**
 * Fetches all indexed documents from the active Qdrant collection.
 * Handles the 404 (non-existent collection) case gracefully.
 * @returns {Promise<Array<{ pageContent: string, metadata: object }>>}
 */
export async function fetchStoredDocuments() {
  const { collectionName } = getEmbeddingService();
  const docs = [];
  let offset;

  do {
    const response = await fetch(`${env.QDRANT_URL}/collections/${collectionName}/points/scroll`, {
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
      if (response.status === 404) {
        return [];
      }
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
