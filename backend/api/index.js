// Vercel serverless entry point. Vercel runs each file under /api as a
// Node.js function. We re-export the Express `app` from ../server.js so the
// full Express router tree serves every request on this deployment.
//
// `vercel.json` rewrites every URL to /api, which means this function
// receives the original URL intact (e.g. GET /api/classes keeps req.url =
// "/api/classes"), so existing Express routes continue to work unchanged.

import app from '../server.js'

export default app
