/**
 * Local mock embeddings that require no API keys.
 * Returns a 1D vector corresponding to the length of the string.
 */
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

/**
 * Resolves the embedding service, vector dimensions, and Qdrant collection name.
 * 
 * @returns {{
 *   instance: object,
 *   vectorSize: number,
 *   collectionName: string
 * }}
 */
export function getEmbeddingService() {
  return {
    instance: new SimpleEmbeddings(),
    vectorSize: 1,
    collectionName: 'pdf-documents-langchain',
  };
}
