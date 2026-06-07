/**
 * ⚔️  QUEST Framework — Response Builder
 *
 * Forges the two weapons every quest handler receives:
 *
 *   loot(data)          — send a success response (200 by default)
 *   loot(code, data)    — send a success response with a custom status
 *
 *   banish(code, msg)   — send an error response and close the connection
 *
 * Also exposes a low-level `scroll(socket, ...)` for raw response writing,
 * and `streamRelic(socket, filePath)` for piping static files.
 */

const fs   = require('fs');
const path = require('path');

// ── Status Texts ──────────────────────────────────────────────────────────────

const STATUS_TEXTS = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  503: 'Service Unavailable',
};

// ── MIME Types ────────────────────────────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css' : 'text/css',
  '.js'  : 'application/javascript',
  '.json': 'application/json',
  '.png' : 'image/png',
  '.jpg' : 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif' : 'image/gif',
  '.svg' : 'image/svg+xml',
  '.ico' : 'image/x-icon',
  '.txt' : 'text/plain; charset=utf-8',
  '.pdf' : 'application/pdf',
  '.woff2': 'font/woff2',
  '.woff' : 'font/woff',
};

function getMime(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function statusText(code) {
  return STATUS_TEXTS[code] || 'Unknown';
}

// ── Low-level Response Writer ─────────────────────────────────────────────────

/**
 * Write a complete HTTP/1.1 response and close the socket.
 * @param {net.Socket} socket
 * @param {number}     statusCode
 * @param {string}     body        - string body (or '' for no body)
 * @param {object}     extraHeaders
 */
function scroll(socket, statusCode, body, extraHeaders = {}) {
  if (socket.destroyed) return;

  const bodyBuffer = Buffer.from(body, 'utf8');

  const headers = {
    'Content-Length': bodyBuffer.length,
    'Connection'    : 'close',
    'X-Powered-By'  : 'Quest/1.0 ⚔️',
    ...extraHeaders,
  };

  let head = `HTTP/1.1 ${statusCode} ${statusText(statusCode)}\r\n`;
  for (const [k, v] of Object.entries(headers)) {
    head += `${k}: ${v}\r\n`;
  }
  head += '\r\n';

  socket.write(head);
  if (bodyBuffer.length > 0) socket.write(bodyBuffer);
  socket.end();
}

// ── Static File Streamer ──────────────────────────────────────────────────────

/**
 * Stream a file (a "relic") directly to the socket.
 * Uses a read stream so large files are never fully buffered in memory.
 * @param {net.Socket} socket
 * @param {string}     filePath  - absolute path to the file
 */
function streamRelic(socket, filePath) {
  if (socket.destroyed) return;

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      scroll(socket, 404, JSON.stringify({ error: 'Relic not found', path: filePath }), {
        'Content-Type': 'application/json',
      });
      return;
    }

    const mime = getMime(filePath);
    const head = [
      `HTTP/1.1 200 OK`,
      `Content-Type: ${mime}`,
      `Content-Length: ${stats.size}`,
      `Connection: close`,
      `X-Powered-By: Quest/1.0 ⚔️`,
      '\r\n',
    ].join('\r\n');

    socket.write(head);

    const stream = fs.createReadStream(filePath);
    stream.pipe(socket);
    stream.on('error', () => socket.destroy());
  });
}

// ── Response Factory ──────────────────────────────────────────────────────────

/**
 * Create the loot() and banish() functions bound to a socket.
 *
 * loot(data)             → 200 JSON response
 * loot(code, data)       → custom status JSON response
 * loot.html(code?, html) → HTML response
 * loot.text(code?, text) → plain text response
 * loot.empty(code?)      → no-body response (e.g. 204)
 *
 * banish(code, message)  → error JSON response
 */
function forgeResponses(socket) {

  // ── loot ──────────────────────────────────────────────────────────
  function loot(codeOrData, data) {
    let statusCode, payload;

    if (typeof codeOrData === 'number') {
      statusCode = codeOrData;
      payload    = data;
    } else {
      statusCode = 200;
      payload    = codeOrData;
    }

    const body = JSON.stringify(payload);
    scroll(socket, statusCode, body, { 'Content-Type': 'application/json' });
  }

  loot.html = function(codeOrHtml, html) {
    const [code, content] = typeof codeOrHtml === 'number'
      ? [codeOrHtml, html]
      : [200, codeOrHtml];
    scroll(socket, code, content, { 'Content-Type': 'text/html; charset=utf-8' });
  };

  loot.text = function(codeOrText, text) {
    const [code, content] = typeof codeOrText === 'number'
      ? [codeOrText, text]
      : [200, codeOrText];
    scroll(socket, code, content, { 'Content-Type': 'text/plain; charset=utf-8' });
  };

  loot.empty = function(code = 204) {
    scroll(socket, code, '', {});
  };

  // ── banish ─────────────────────────────────────────────────────────
  function banish(code = 500, message = 'Something went wrong in the dungeon.') {
    const body = JSON.stringify({
      error  : statusText(code),
      message: message,
      code,
    });
    scroll(socket, code, body, { 'Content-Type': 'application/json' });
  }

  return { loot, banish };
}

module.exports = { forgeResponses, streamRelic, scroll, getMime };