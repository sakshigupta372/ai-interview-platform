const { verifyToken } = require("@clerk/backend");

/**
 * Verifies the Clerk session JWT sent as `Authorization: Bearer <token>` and
 * sets `req.auth.userId` from the verified token. Identity must always come
 * from here, never from the URL or request body.
 *
 * Fails closed: if CLERK_SECRET_KEY is missing the request is rejected.
 */
async function requireAuth(req, res, next) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("CLERK_SECRET_KEY is not set; rejecting authenticated request.");
    return res.status(503).json({ error: "Server authentication is not configured." });
  }

  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || "");
  if (!match) return res.status(401).json({ error: "Authentication required." });

  try {
    const payload = await verifyToken(match[1], { secretKey });
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "Invalid or expired session." });
    }
    req.auth = { userId: payload.sub };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session." });
  }
}

/**
 * Loads a session by id and checks it belongs to the authenticated user.
 * Returns the session, or sends 404/403 and returns null.
 * 404 is used for both "missing" and "not yours" on purpose, so ids can't be probed.
 */
async function loadOwnedSession(sessionService, req, res, sessionId) {
  const session = await sessionService.getSession(sessionId);
  if (!session || !session.clerkId || session.clerkId !== req.auth.userId) {
    res.status(404).json({ error: "Session not found" });
    return null;
  }
  return session;
}

module.exports = { requireAuth, loadOwnedSession };
