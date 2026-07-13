/**
 * Generates the system prompt containing the retrieved context for RAG.
 * 
 * @param {string} context 
 * @returns {string} System prompt template
 */
export function getRagPrompt(context) {
  return `Answer the user using only this PDF context. If the answer is not in the context, say you do not know.\n\nContext:\n${context}`;
}
