/**
 * ⚔️  QUEST Framework — Static File Server (The Vault)
 *
 * Serves static "relics" (files) from a directory.
 * Equivalent to express.static() but built on raw fs + our streamRelic().
 *
 * Features:
 *  - Serves any file type with correct MIME type
 *  - Auto-serves index.html for directory requests
 *  - Blocks directory traversal attacks (../ exploits)
 *  - Returns clean 404 JSON via banish() when file not found
 */

const fs   = require('fs');
const path = require('path');
const { streamRelic, scroll } = require('./response');

/**
 * Create a static file handler for a given directory.
 *
 * @param {string} vaultDir   - Path to the directory to serve from
 * @param {object} [options]
 * @param {string} [options.prefix]   - URL prefix to strip before mapping to file (e.g. '/static')
 * @param {string} [options.index]    - Default index file (default: 'index.html')
 *
 * @returns {Function} handler(adventurer, socket) — call this inside the dungeon
 *
 * Usage:
 *   const vault = openVault('./public');
 *   dungeon.vault('/public', vault);
 */
function openVault(vaultDir, options = {}) {
  const resolvedVault = path.resolve(vaultDir);
  const prefix        = options.prefix || '';
  const indexFile     = options.index  || 'index.html';

  // Ensure the vault directory exists
  if (!fs.existsSync(resolvedVault)) {
    throw new Error(`[QUEST Vault] Directory not found: "${resolvedVault}"`);
  }

  /**
   * The actual handler — called by Dungeon when a request matches the vault prefix.
   * @param {object}     adventurer
   * @param {net.Socket} socket
   */
  return function vaultHandler(adventurer, socket, onStatus) {
  let decoded;
  try {
    decoded = decodeURIComponent(adventurer.path.startsWith(prefix)
      ? adventurer.path.slice(prefix.length) || '/'
      : adventurer.path);
  } catch {
    if (onStatus) onStatus(400);
    banishRaw(socket, 400, 'Bad request path');
    return;
  }

  const filePath     = path.join(resolvedVault, decoded);
  const resolvedFile = path.resolve(filePath);

  if (!resolvedFile.startsWith(resolvedVault + path.sep) &&
      resolvedFile !== resolvedVault) {
    if (onStatus) onStatus(403);
    banishRaw(socket, 403, 'Access denied — the dungeon guards this path.');
    return;
  }

  fs.stat(resolvedFile, (err, stats) => {
    if (!err && stats.isDirectory()) {
      const indexPath = path.join(resolvedFile, indexFile);
      fs.stat(indexPath, (idxErr, idxStats) => {
        if (!idxErr && idxStats.isFile()) {
          if (onStatus) onStatus(200);
          streamRelic(socket, indexPath);
        } else {
          if (onStatus) onStatus(403);
          banishRaw(socket, 403, 'Directory listing is forbidden.');
        }
      });
      return;
    }

    if (err || !stats.isFile()) {
      if (onStatus) onStatus(404);
      banishRaw(socket, 404, `Relic not found: ${decoded}`);
      return;
    }

    if (onStatus) onStatus(200);
    streamRelic(socket, resolvedFile);
  });
};

}

/** Quick error response without needing a full forgeResponses call */
function banishRaw(socket, code, message) {
  const body = JSON.stringify({ error: message, code });
  scroll(socket, code, body, { 'Content-Type': 'application/json' });
}

module.exports = { openVault };