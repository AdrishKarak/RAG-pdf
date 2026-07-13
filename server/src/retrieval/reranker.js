/**
 * Tokenizes a string into individual alphanumeric tokens.
 * @param {string} value 
 * @returns {string[]}
 */
function tokenize(value) {
  return String(value)
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter(token => token.length > 1) ?? [];
}

/**
 * Ranks or scores documents lexically against a query using term and phrase frequency matches.
 * Useful for keyword-based search or secondary reranking.
 * 
 * @param {string} query 
 * @param {Array<{ pageContent: string, metadata: object }>} docs 
 * @returns {Array<{ pageContent: string, metadata: object }>} Sorted documents
 */
export function rankDocuments(query, docs) {
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
        // Safe regex generation for term matching
        try {
          const contentMatches = content.match(new RegExp(`\\b${term}\\b`, 'g'))?.length ?? 0;
          const filenameMatches = filename.includes(term) ? 3 : 0;
          score += contentMatches + filenameMatches;
        } catch {
          // Fallback if regex generation fails for weird characters
          if (content.includes(term)) score += 1;
        }
      }

      return { doc, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.doc.metadata?.path ?? '').localeCompare(String(a.doc.metadata?.path ?? ''));
    })
    .map(item => item.doc);
}
