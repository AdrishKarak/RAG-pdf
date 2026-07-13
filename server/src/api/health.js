/**
 * Health check route handler.
 */
export function healthCheck(req, res) {
  return res.json({
    status: 200,
    message: 'Hello from the RAG server API'
  });
}
