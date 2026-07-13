import { retrieveRelevantDocs } from '../retrieval/retriever.js';
import { getRagPrompt } from '../prompts/ragPrompt.js';
import { generateCompletion } from '../llm/chat.js';

/**
 * Handles incoming chat/query requests.
 * Retrieves relevant chunks from the vector store, compiles context,
 * invokes the LLM with the RAG prompt, and returns the response alongside sources.
 */
export async function handleChat(req, res) {
  try {
    const userQuery = req.query.message;

    if (!userQuery) {
      return res.status(400).json({ message: 'message query param is required' });
    }

    // 1. Retrieve the most relevant chunks matching the query
    const docs = await retrieveRelevantDocs(userQuery, 4);

    // 2. Build the context string within safety limits
    const maxChars = 20000;
    let used = 0;
    const context = docs
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

    // 3. Construct prompt and generate LLM answer
    const systemPrompt = getRagPrompt(context);
    const answer = await generateCompletion(systemPrompt, userQuery);

    // 4. Respond with generated message and supporting source documents
    return res.json({
      message: answer,
      docs: docs,
    });
  } catch (err) {
    console.error('[API] Chat failed:', err);
    return res.status(500).json({
      message: 'Chat failed',
      error: err.message
    });
  }
}
