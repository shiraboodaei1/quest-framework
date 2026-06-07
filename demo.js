/**
 * ⚔️  QUEST Framework — Demo App
 *
 * Run with: node demo.js
 * Then visit: http://localhost:3000
 *
 * This demo showcases:
 *  1. Route handlers (GET, POST, PUT, DELETE)
 *  2. Route parameters (:id)
 *  3. Query string parsing
 *  4. JSON body parsing
 *  5. Middleware spells
 *  6. Route groups
 *  7. Static file serving
 *  8. Error handling with banish()
 *  9. loot.html() for HTML responses
 * 10. The creative "rate limiter" spell
 */

'use strict';

const { Dungeon } = require('./index');

const dungeon = new Dungeon({ name: 'Hero\'s Guild' });

// ═══════════════════════════════════════════════════════════════
// 🔮 SPELLS (Middleware)
// ═══════════════════════════════════════════════════════════════

// Spell 1: CORS — let any realm access the dungeon
dungeon.spell((adventurer, loot, banish, next) => {
  adventurer._cors = {
    'Access-Control-Allow-Origin' : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  next();
});

// Spell 2: Simple rate limiter (max 100 requests per IP per minute)
const ipHits = new Map();
dungeon.spell((adventurer, loot, banish, next) => {
  const ip  = adventurer.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const hit = ipHits.get(ip) || { count: 0, since: now };

  // Reset window after 60 seconds
  if (now - hit.since > 60_000) {
    hit.count = 0;
    hit.since = now;
  }

  hit.count++;
  ipHits.set(ip, hit);

  if (hit.count > 100) {
    return banish(429, 'Too many quests! Rest, adventurer.');
  }

  next();
});

// ═══════════════════════════════════════════════════════════════
// 🏛️  VAULT (Static Files)
// ═══════════════════════════════════════════════════════════════

dungeon.vault('/public', './public');

// ═══════════════════════════════════════════════════════════════
// 🗺️  QUESTS (Routes)
// ═══════════════════════════════════════════════════════════════

// ── Root ───────────────────────────────────────────────────────
dungeon.quest('GET /', (adventurer, loot) => {
  loot.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>⚔️ QUEST Framework</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          background: #0d0d0d;
          color: #e2c97e;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }
        .card {
          max-width: 640px;
          width: 100%;
          border: 1px solid #3a3a2a;
          border-radius: 4px;
          padding: 3rem;
          background: #111108;
          box-shadow: 0 0 60px rgba(226,201,126,0.05);
        }
        h1 { font-size: 2rem; margin-bottom: 0.25rem; letter-spacing: 2px; }
        .sub { color: #6b6b50; font-size: 0.85rem; margin-bottom: 2rem; }
        h2 { font-size: 0.7rem; letter-spacing: 3px; color: #6b6b50;
             text-transform: uppercase; margin: 1.5rem 0 0.75rem; }
        .route {
          display: flex; gap: 1rem; align-items: center;
          padding: 0.5rem 0.75rem; margin-bottom: 0.4rem;
          border-radius: 3px; background: #161610;
          font-size: 0.82rem;
        }
        .method { font-weight: bold; min-width: 60px; }
        .get    { color: #4ec94e; }
        .post   { color: #4e8ce8; }
        .put    { color: #e8c44e; }
        .delete { color: #e85a4e; }
        .path   { color: #c0bfa0; flex: 1; }
        .desc   { color: #4a4a38; font-size: 0.75rem; }
        a { color: inherit; text-decoration: none; }
        .footer { margin-top: 2rem; color: #3a3a2a; font-size: 0.75rem; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>⚔️ QUEST</h1>
        <p class="sub">An RPG-themed HTTP framework · Built on Node.js net · No dependencies</p>

        <h2>Heroes API</h2>
        <div class="route"><span class="method get">GET</span><span class="path">/api/heroes</span><span class="desc">List all heroes</span></div>
        <div class="route"><span class="method get">GET</span><span class="path">/api/heroes/:id</span><span class="desc">Get a hero by ID</span></div>
        <div class="route"><span class="method post">POST</span><span class="path">/api/heroes</span><span class="desc">Create a hero</span></div>
        <div class="route"><span class="method put">PUT</span><span class="path">/api/heroes/:id</span><span class="desc">Update a hero</span></div>
        <div class="route"><span class="method delete">DELETE</span><span class="path">/api/heroes/:id</span><span class="desc">Banish a hero</span></div>

        <h2>Dungeon</h2>
        <div class="route"><span class="method get">GET</span><span class="path">/api/dungeon</span><span class="desc">Dungeon status</span></div>
        <div class="route"><span class="method get">GET</span><span class="path">/api/search</span><span class="desc">Search heroes (?name=)</span></div>

        <h2>Static Vault</h2>
        <div class="route"><span class="method get">GET</span><span class="path">/public/*</span><span class="desc">Served from ./public/</span></div>

        <p class="footer">⚔️ QUEST Framework · Built for Full Stack Engineering · Reichman University 2026</p>
      </div>
    </body>
    </html>
  `);
});

// ── In-memory hero store ───────────────────────────────────────
const heroes = [
  { id: 1, name: 'Aria Shadowbane',  class: 'Rogue',   level: 42, hp: 280 },
  { id: 2, name: 'Thorin Ironforge', class: 'Warrior',  level: 38, hp: 520 },
  { id: 3, name: 'Lyra Moonwhisper', class: 'Mage',     level: 55, hp: 190 },
];
let nextId = 4;

// ── API Group: /api ────────────────────────────────────────────
dungeon.group('/api', (api) => {

  // GET /api/dungeon — dungeon status
  api.quest('GET /dungeon', (adventurer, loot) => {
    loot({
      name   : "Hero's Guild",
      status : 'open',
      heroes : heroes.length,
      uptime : Math.floor(process.uptime()) + 's',
      framework: 'QUEST/1.0 ⚔️',
    });
  });

  // GET /api/search?name=aria
  api.quest('GET /search', (adventurer, loot, banish) => {
    const { name, class: heroClass } = adventurer.query;

    let results = [...heroes];
    if (name)      results = results.filter(h => h.name.toLowerCase().includes(name.toLowerCase()));
    if (heroClass) results = results.filter(h => h.class.toLowerCase() === heroClass.toLowerCase());

    loot({ count: results.length, results });
  });

  // GET /api/heroes
  api.quest('GET /heroes', (adventurer, loot) => {
    loot({ count: heroes.length, heroes });
  });

  // GET /api/heroes/:id
  api.quest('GET /heroes/:id', (adventurer, loot, banish) => {
    const hero = heroes.find(h => h.id === parseInt(adventurer.params.id));
    if (!hero) return banish(404, `No hero with id ${adventurer.params.id} found in the guild.`);
    loot(hero);
  });

  // POST /api/heroes
  api.quest('POST /heroes', (adventurer, loot, banish) => {
    const { name, class: heroClass, level } = adventurer.body || {};

    if (!name)      return banish(400, 'Every hero needs a name.');
    if (!heroClass) return banish(400, 'Every hero needs a class (Warrior, Mage, Rogue...).');

    const hero = {
      id    : nextId++,
      name,
      class : heroClass,
      level : level || 1,
      hp    : heroClass === 'Warrior' ? 500 : heroClass === 'Mage' ? 180 : 260,
    };
    heroes.push(hero);
    loot(201, { message: 'Hero joined the guild!', hero });
  });

  // PUT /api/heroes/:id
  api.quest('PUT /heroes/:id', (adventurer, loot, banish) => {
    const idx = heroes.findIndex(h => h.id === parseInt(adventurer.params.id));
    if (idx === -1) return banish(404, `Hero ${adventurer.params.id} not found.`);

    const updates = adventurer.body || {};
    heroes[idx] = { ...heroes[idx], ...updates, id: heroes[idx].id };
    loot({ message: 'Hero updated.', hero: heroes[idx] });
  });

  // DELETE /api/heroes/:id
  api.quest('DELETE /heroes/:id', (adventurer, loot, banish) => {
    const idx = heroes.findIndex(h => h.id === parseInt(adventurer.params.id));
    if (idx === -1) return banish(404, `Hero ${adventurer.params.id} not found.`);

    const [removed] = heroes.splice(idx, 1);
    loot({ message: `${removed.name} has been banished from the guild.`, hero: removed });
  });

});

// ═══════════════════════════════════════════════════════════════
// 🚪 OPEN THE GATES
// ═══════════════════════════════════════════════════════════════

dungeon.open(3000);