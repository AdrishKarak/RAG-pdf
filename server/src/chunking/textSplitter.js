/**
 * A robust, self-contained Recursive Character Text Splitter.
 * Mimics Langchain's RecursiveCharacterTextSplitter to split text
 * into semantically rich chunks by trying paragraph, sentence, and word boundary separators.
 */
export class RecursiveCharacterTextSplitter {
  constructor({ chunkSize = 1000, chunkOverlap = 200 } = {}) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  /**
   * Splits a long string into chunks.
   * @param {string} text 
   * @returns {string[]}
   */
  splitText(text) {
    if (!text || typeof text !== 'string') return [];
    
    const separators = ["\n\n", "\n", " ", ""];
    return this._split(text, separators);
  }

  _split(text, separators) {
    const finalChunks = [];
    
    if (text.length <= this.chunkSize) {
      return [text];
    }
    
    // Find the first separator present in the text
    let separator = separators[separators.length - 1];
    let separatorIndex = separators.length - 1;
    for (let i = 0; i < separators.length; i++) {
      if (text.includes(separators[i])) {
        separator = separators[i];
        separatorIndex = i;
        break;
      }
    }
    
    const parts = text.split(separator);
    let currentChunk = "";
    
    for (const part of parts) {
      // Check if adding this part would exceed the chunk size
      if ((currentChunk + (currentChunk ? separator : "") + part).length > this.chunkSize) {
        if (currentChunk) {
          finalChunks.push(currentChunk);
        }
        
        // Handle parts that are larger than the chunk size
        if (part.length > this.chunkSize) {
          const remainingSeparators = separators.slice(separatorIndex + 1);
          if (remainingSeparators.length > 0) {
            const subChunks = this._split(part, remainingSeparators);
            finalChunks.push(...subChunks);
          } else {
            finalChunks.push(part);
          }
          currentChunk = "";
        } else {
          currentChunk = part;
        }
      } else {
        currentChunk = currentChunk ? currentChunk + separator + part : part;
      }
    }
    
    if (currentChunk) {
      finalChunks.push(currentChunk);
    }
    
    return this._mergeSplits(finalChunks);
  }

  _mergeSplits(splits) {
    const docs = [];
    let currentDoc = "";
    
    for (const split of splits) {
      if (!split) continue;
      
      if ((currentDoc + (currentDoc ? " " : "") + split).length > this.chunkSize) {
        if (currentDoc) {
          docs.push(currentDoc);
        }
        
        // Start next chunk with overlapping content
        if (this.chunkOverlap > 0 && currentDoc) {
          const overlapStart = Math.max(0, currentDoc.length - this.chunkOverlap);
          const overlapText = currentDoc.slice(overlapStart);
          currentDoc = overlapText + (overlapText ? " " : "") + split;
        } else {
          currentDoc = split;
        }
      } else {
        currentDoc = currentDoc ? currentDoc + " " : "" + split;
      }
    }
    
    if (currentDoc) {
      docs.push(currentDoc);
    }
    
    return docs;
  }
}

/**
 * Convenience helper to split text.
 * @param {string} text 
 * @param {object} options 
 * @returns {string[]}
 */
export function splitTextIntoChunks(text, options = {}) {
  const splitter = new RecursiveCharacterTextSplitter(options);
  return splitter.splitText(text);
}
