/**
 * ⚔️  QUEST Framework — Router
 *
 * The Questboard. Routes are "quests" — registered with a terse
 * "METHOD /path" string and matched against incoming adventurers.
 *
 * Supports:
 *  - Exact paths:       "GET /heroes"
 *  - Param segments:    "GET /heroes/:id"
 *  - Wildcard suffix:   "GET /docs/*"
 */

class QuestBoard {
  constructor() {
    /** @type {Array<{method:string, regex:RegExp, paramNames:string[], handler:Function}>} */
    this._quests = [];
  }

  /**
   * Register a quest.
   * @param {string}   signature  - e.g. "GET /heroes/:id"
   * @param {Function} handler    - (adventurer, loot, banish) => void
   */
  register(signature, handler) {
    const spaceIdx = signature.indexOf(' ');
    if (spaceIdx === -1) {
      throw new Error(`[QUEST] Invalid quest signature: "${signature}". Use "METHOD /path".`);
    }

    const method    = signature.slice(0, spaceIdx).toUpperCase();
    const rawPath   = signature.slice(spaceIdx + 1).trim();
    const { regex, paramNames } = compilePath(rawPath);

    this._quests.push({ method, regex, paramNames, handler });
  }

  /**
   * Match an adventurer to a registered quest.
   * @param {string} method
   * @param {string} path
   * @returns {{ handler: Function, params: object } | null}
   */
  match(method, path) {
    for (const quest of this._quests) {
      if (quest.method !== method.toUpperCase()) continue;

      const m = path.match(quest.regex);
      if (!m) continue;

      // Build params object from captured groups
      const params = {};
      quest.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1] || '');
      });

      return { handler: quest.handler, params };
    }
    return null;
  }
}

// ── Path Compiler ─────────────────────────────────────────────────────────────

/**
 * Convert a path pattern into a regex + list of param names.
 *
 * Examples:
 *   "/heroes"        → /^\/heroes$/
 *   "/heroes/:id"    → /^\/heroes\/([^/]+)$/   paramNames: ['id']
 *   "/files/*"       → /^\/files\/(.*)$/        paramNames: ['*']
 */
function compilePath(pattern) {
  const paramNames = [];

  // Escape special regex chars except : and *
  let regexStr = pattern
    .replace(/[-[\]{}()+?.,\\^$|#\s]/g, '\\$&') // escape regex specials
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';                           // named param segment
    })
    .replace(/\\\*/g, () => {
      paramNames.push('*');
      return '(.*)';                              // wildcard suffix
    });

  return {
    regex: new RegExp(`^${regexStr}$`),
    paramNames,
  };
}

module.exports = { QuestBoard };