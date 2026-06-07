/**
 * ⚔️  QUEST Framework — HTTP Parser
 *
 * Transforms raw TCP bytes into a clean "adventurer" object.
 * An adventurer carries everything about the incoming request:
 * their method, path, query, headers, body, and params.
 */

/**
 * Parse a raw HTTP/1.1 request buffer into an adventurer object.
 * @param {Buffer} raw - Raw data from the TCP socket
 * @returns {object} adventurer
 */
function parseAdventurer(raw) {
  const text = raw.toString();

  // Split head (request line + headers) from body at the blank line
  const separatorIndex = text.indexOf('\r\n\r\n');
  const head = separatorIndex !== -1 ? text.slice(0, separatorIndex) : text;
  const rawBody = separatorIndex !== -1 ? text.slice(separatorIndex + 4) : '';

  const lines = head.split('\r\n');

  // ── Request Line ────────────────────────────────────────────────
  // e.g. "GET /api/heroes?page=1 HTTP/1.1"
  const [method, fullPath = '/', version = 'HTTP/1.1'] = (lines[0] || '').split(' ');

  // ── Path & Query String ─────────────────────────────────────────
  const qMark = fullPath.indexOf('?');
  const path = qMark === -1 ? fullPath : fullPath.slice(0, qMark);
  const queryString = qMark === -1 ? '' : fullPath.slice(qMark + 1);

  const query = {};
  if (queryString) {
    for (const pair of queryString.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx === -1) continue;
      const key = safeDecodeURIComponent(pair.slice(0, eqIdx));
      const val = safeDecodeURIComponent(pair.slice(eqIdx + 1));
      query[key] = val;
    }
  }

  // ── Headers ─────────────────────────────────────────────────────
  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const colonIdx = lines[i].indexOf(':');
    if (colonIdx < 1) continue;
    const key = lines[i].slice(0, colonIdx).toLowerCase().trim();
    const value = lines[i].slice(colonIdx + 1).trim();
    headers[key] = value;
  }

  // ── Body ─────────────────────────────────────────────────────────
  // Trim body to content-length if provided (avoids TCP padding noise)
  const contentLength = parseInt(headers['content-length'] || '0', 10);
  const trimmedBody = contentLength > 0 ? rawBody.slice(0, contentLength) : rawBody;

  let body = null;
  const contentType = headers['content-type'] || '';

  if (trimmedBody) {
    if (contentType.includes('application/json')) {
      try {
        body = JSON.parse(trimmedBody);
      } catch {
        body = trimmedBody; // fall back to raw string if JSON is malformed
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      body = {};
      for (const pair of trimmedBody.split('&')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx === -1) continue;
        body[safeDecodeURIComponent(pair.slice(0, eqIdx))] =
          safeDecodeURIComponent(pair.slice(eqIdx + 1));
      }
    } else {
      body = trimmedBody;
    }
  }

  // ── Adventurer Object ────────────────────────────────────────────
  return {
    method: (method || 'GET').toUpperCase(),
    path:   normalizePath(path),
    query,
    headers,
    body,
    version,
    params: {}, // filled in by the router when a quest is matched
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize a URL path: always starts with /, no trailing slash (except root) */
function normalizePath(p) {
  if (!p || p === '/') return '/';
  const normalized = p.startsWith('/') ? p : `/${p}`;
  return normalized.length > 1 && normalized.endsWith('/')
    ? normalized.slice(0, -1)
    : normalized;
}

/** decodeURIComponent that never throws */
function safeDecodeURIComponent(str) {
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch {
    return str;
  }
}

module.exports = { parseAdventurer };