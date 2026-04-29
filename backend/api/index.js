// Vercel serverless entry point. Re-exports the Express `app` from ../server.js.
// Path restoration for stripped `req.url` is handled in server.js (restoreVercelRequestPath).

import app from '../server.js'

export default app
