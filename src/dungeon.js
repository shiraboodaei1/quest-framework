/**
 * ⚔️  QUEST Framework — The Dungeon
 *
 * The heart of the framework. A Dungeon:
 *  - Opens its gates on a TCP port (net.createServer)
 *  - Receives adventurers (parses HTTP requests)
 *  - Runs them through spells (middleware pipeline)
 *  - Matches them to quests (routes)
 *  - Serves relics from vaults (static files)
 *  - Sends them off with loot or banishes them
 *
 * API at a glance:
 *
 *   const dungeon = new Dungeon();
 *
 *   dungeon.spell(fn)                        // middleware
 *   dungeon.quest('GET /path', handler)      // route
 *   dungeon.vault('/static', openVault(...)) // static files
 *   dungeon.group('/api', (d) => { ... })    // route group
 *   dungeon.open(3000)                       // start server
 */

'use strict';

const net  = require('net');
const { parseAdventurer } = require('./parser');
const { QuestBoard }      = require('./router');
const { forgeResponses, scroll }   = require('./response');
const { openVault }       = require('./static');

// ── Terminal Colors (no dependencies!) ───────────────────────────────────────
const C = {
  reset  : '\x1b[0m',
  bold   : '\x1b[1m',
  dim    : '\x1b[2m',
  red    : '\x1b[31m',
  green  : '\x1b[32m',
  yellow : '\x1b[33m',
  blue   : '\x1b[34m',
  magenta: '\x1b[35m',
  cyan   : '\x1b[36m',
  white  : '\x1b[37m',
  gray   : '\x1b[90m',
};

const METHOD_COLORS = {
  GET    : C.green,
  POST   : C.blue,
  PUT    : C.yellow,
  PATCH  : C.magenta,
  DELETE : C.red,
  OPTIONS: C.cyan,
};

function colorMethod(method) {
  const color = METHOD_COLORS[method] || C.white;
  return `${color}${C.bold}${method.padEnd(7)}${C.reset}`;
}

function colorStatus(code) {
  if (code < 300) return `${C.green}${code}${C.reset}`;
  if (code < 400) return `${C.cyan}${code}${C.reset}`;
  if (code < 500) return `${C.yellow}${code}${C.reset}`;
  return `${C.red}${code}${C.reset}`;
}

// ── Dungeon Class ─────────────────────────────────────────────────────────────

class Dungeon {
  constructor(options = {}) {
    this._board    = new QuestBoard();   // the quest registry
    this._spells   = [];                 // middleware pipeline
    this._vaults   = [];                 // static file mounts [{prefix, handler}]
    this._options  = {
      log    : options.log    !== false, // colored request logging (default: on)
      name   : options.name   || 'Dungeon',
    };
    this._server   = null;
  }

  // ── Spells (Middleware) ─────────────────────────────────────────────────────

  /**
   * Add a spell (middleware) to the pipeline.
   * Spells run in order before any quest handler.
   *
   * @param {Function} fn  (adventurer, loot, banish, next) => void
   *
   * Example:
   *   dungeon.spell((adventurer, loot, banish, next) => {
   *     console.log(adventurer.method, adventurer.path);
   *     next(); // MUST call next() to continue
   *   });
   */
  spell(fn) {
    this._spells.push(fn);
    return this; // chainable
  }

  // ── Quests (Routes) ────────────────────────────────────────────────────────

  /**
   * Register a quest (route).
   *
   * @param {string}   signature  "METHOD /path"  e.g. "GET /heroes/:id"
   * @param {Function} handler    (adventurer, loot, banish) => void
   *
   * Example:
   *   dungeon.quest('GET /heroes/:id', (adventurer, loot, banish) => {
   *     loot({ id: adventurer.params.id });
   *   });
   */
  quest(signature, handler) {
    this._board.register(signature, handler);
    return this;
  }

  // ── Shorthand Quest Methods ────────────────────────────────────────────────

  /** dungeon.get('/path', handler) */
  get(path, handler)    { return this.quest(`GET ${path}`, handler); }
  /** dungeon.post('/path', handler) */
  post(path, handler)   { return this.quest(`POST ${path}`, handler); }
  /** dungeon.put('/path', handler) */
  put(path, handler)    { return this.quest(`PUT ${path}`, handler); }
  /** dungeon.patch('/path', handler) */
  patch(path, handler)  { return this.quest(`PATCH ${path}`, handler); }
  /** dungeon.delete('/path', handler) */
  delete(path, handler) { return this.quest(`DELETE ${path}`, handler); }

  // ── Vaults (Static Files) ──────────────────────────────────────────────────

  /**
   * Mount a static file vault at a URL prefix.
   *
   * @param {string} prefix     URL prefix, e.g. '/static'
   * @param {string} directory  Directory path, e.g. './public'
   *
   * Example:
   *   dungeon.vault('/static', './public');
   *   // GET /static/style.css → serves ./public/style.css
   */
  vault(prefix, directory) {
    const handler = openVault(directory, { prefix });
    this._vaults.push({ prefix, handler });
    return this;
  }

  // ── Route Groups ───────────────────────────────────────────────────────────

  /**
   * Group routes under a common prefix.
   *
   * @param {string}   prefix   e.g. '/api'
   * @param {Function} fn       receives a proxy dungeon scoped to the prefix
   *
   * Example:
   *   dungeon.group('/api', (api) => {
   *     api.quest('GET /heroes', handler);   // → GET /api/heroes
   *     api.quest('POST /heroes', handler);  // → POST /api/heroes
   *   });
   */
  group(prefix, fn) {
    const proxy = {
      quest : (sig, handler) => {
        const spaceIdx = sig.indexOf(' ');
        const method   = sig.slice(0, spaceIdx);
        const path     = sig.slice(spaceIdx + 1);
        this._board.register(`${method} ${prefix}${path}`, handler);
        return proxy;
      },
      get   : (p, h) => proxy.quest(`GET ${p}`, h),
      post  : (p, h) => proxy.quest(`POST ${p}`, h),
      put   : (p, h) => proxy.quest(`PUT ${p}`, h),
      patch : (p, h) => proxy.quest(`PATCH ${p}`, h),
      delete: (p, h) => proxy.quest(`DELETE ${p}`, h),
    };
    fn(proxy);
    return this;
  }

  // ── Request Handler ────────────────────────────────────────────────────────

  _handle(socket, raw) {
    const adventurer = parseAdventurer(raw);
    const { loot, banish } = forgeResponses(socket);
    const startTime = Date.now();

    // Intercept loot/banish to log the response status
    const loggedLoot = (...args) => {
      this._log(adventurer, args[0] && typeof args[0] === 'number' ? args[0] : 200, startTime);
      loot(...args);
    };
    loggedLoot.html  = (...args) => { this._log(adventurer, typeof args[0] === 'number' ? args[0] : 200, startTime); loot.html(...args); };
    loggedLoot.text  = (...args) => { this._log(adventurer, typeof args[0] === 'number' ? args[0] : 200, startTime); loot.text(...args); };
    loggedLoot.empty = (...args) => { this._log(adventurer, args[0] || 204, startTime); loot.empty(...args); };

    const loggedBanish = (code, ...args) => {
      this._log(adventurer, code || 500, startTime);
      banish(code, ...args);
    };

    // ── Vault check (static files first) ──────────────────────────
    for (const { prefix, handler } of this._vaults) {
      if (adventurer.path.startsWith(prefix)) {
        this._log(adventurer, 200, startTime);
        handler(adventurer, socket);
        return;
      }
    }

    // ── Run spell pipeline then dispatch to quest ──────────────────
    this._runSpells(adventurer, loggedLoot, loggedBanish, () => {
      const matched = this._board.match(adventurer.method, adventurer.path);

      if (!matched) {
        loggedBanish(404, `No quest found for ${adventurer.method} ${adventurer.path}`);
        return;
      }

      adventurer.params = matched.params;

      try {
        matched.handler(adventurer, loggedLoot, loggedBanish);
      } catch (err) {
        console.error(`${C.red}[QUEST ERROR]${C.reset}`, err.message);
        loggedBanish(500, 'An unexpected darkness fell upon the dungeon.');
      }
    });
  }

  /** Run middleware spells in sequence */
  _runSpells(adventurer, loot, banish, done) {
    const spells = this._spells;
    let i = 0;

    function next() {
      if (i >= spells.length) { done(); return; }
      const spell = spells[i++];
      try {
        spell(adventurer, loot, banish, next);
      } catch (err) {
        console.error(`${C.red}[SPELL ERROR]${C.reset}`, err.message);
        banish(500, 'A spell backfired in the dungeon.');
      }
    }

    next();
  }

  // ── Logging ────────────────────────────────────────────────────────────────

  _log(adventurer, statusCode, startTime) {
    if (!this._options.log) return;
    const ms      = Date.now() - startTime;
    const time    = new Date().toLocaleTimeString();
    const elapsed = ms < 10 ? `${C.green}${ms}ms${C.reset}` : ms < 100 ? `${C.yellow}${ms}ms${C.reset}` : `${C.red}${ms}ms${C.reset}`;

    console.log(
      `${C.gray}[${time}]${C.reset} ` +
      `${colorMethod(adventurer.method)} ` +
      `${C.white}${adventurer.path}${C.reset}` +
      (Object.keys(adventurer.query).length ? `${C.gray}?${JSON.stringify(adventurer.query).slice(1,-1).replace(/"/g,'')}${C.reset}` : '') +
      ` ${colorStatus(statusCode)} ` +
      `${C.dim}${elapsed}${C.reset}`
    );
  }

  // ── Open the Gates ─────────────────────────────────────────────────────────

  /**
   * Start the dungeon server.
   * @param {number}   port
   * @param {Function} [onReady]  callback when listening
   */
  open(port = 3000, onReady) {
    // Buffer incoming data per socket (handles chunked TCP packets)
    this._server = net.createServer((socket) => {
      let buffer = Buffer.alloc(0);

      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        // Wait until we have the full headers at minimum
        const sep = buffer.indexOf('\r\n\r\n');
        if (sep === -1) return; // still receiving headers

        // Check Content-Length to know if we have the full body
        const head = buffer.slice(0, sep).toString();
        const clMatch = head.match(/content-length:\s*(\d+)/i);
        const contentLength = clMatch ? parseInt(clMatch[1], 10) : 0;
        const bodyReceived = buffer.length - sep - 4;

        if (bodyReceived < contentLength) return; // still receiving body

        // We have a complete request — handle it
        const raw = buffer;
        buffer = Buffer.alloc(0);
        this._handle(socket, raw);
      });

      socket.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
          console.error(`${C.red}[SOCKET ERROR]${C.reset}`, err.message);
        }
      });
    });

    this._server.listen(port, () => {
      console.log('');
      console.log(`  ${C.yellow}${C.bold}⚔️  QUEST Framework${C.reset}`);
      console.log(`  ${C.gray}The ${this._options.name} is open at${C.reset} ${C.cyan}${C.bold}http://localhost:${port}${C.reset}`);
      console.log(`  ${C.gray}────────────────────────────────────${C.reset}`);
      console.log('');
      if (onReady) onReady(port);
    });

    return this;
  }

  /** Gracefully close the dungeon */
  close(cb) {
    if (this._server) this._server.close(cb);
  }
}

module.exports = { Dungeon, openVault };