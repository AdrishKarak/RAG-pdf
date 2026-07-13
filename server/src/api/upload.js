import { addPdfJob, pdfQueueEvents } from '../queue/jobs/pdfJob.js';

/**
 * Handles PDF uploads.
 * Accepts a PDF file, dispatches an indexing job to BullMQ,
 * waits for the worker to complete processing, and returns the result.
 */
export async function uploadPdf(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    console.log(`[API] Received upload request for file: ${req.file.originalname}`);

    // Dispatch the ingestion job to the queue
    const job = await addPdfJob(req.file);

    // Wait for the worker to finish chunking and indexing the PDF
    console.log(`[API] Enqueued job ${job.id}. Waiting for worker to complete...`);
    const result = await job.waitUntilFinished(pdfQueueEvents);

    console.log(`[API] Ingestion complete for job ${job.id}.`);

    return res.json({
      status: 200,
      message: 'PDF uploaded and indexed successfully',
      file: req.file,
      result
    });
  } catch (err) {
    console.error('[API] Ingestion failed:', err);
    return res.status(500).json({
      message: 'Upload and indexing failed',
      error: err.message
    });
  }
}
