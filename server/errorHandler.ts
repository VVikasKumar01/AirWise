import type { ErrorRequestHandler } from 'express';

/** Return safe JSON errors without exposing internal exception details. */
export const apiErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = err as { type?: string } | null;

  if (error?.type === 'entity.too.large') {
    res.status(413).json({
      error: 'Request payload is too large. Please keep voice clips under 45 seconds.',
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Invalid JSON request body.' });
    return;
  }

  res.status(500).json({ error: 'An unexpected server error occurred.' });
};
