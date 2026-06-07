# ⚔️ QUEST Framework

> An RPG-themed HTTP framework built from scratch on Node.js's raw `net` module.  
> No `http` module. No third-party libraries. Just TCP and imagination.

---

## 🏰 The Concept

Most HTTP frameworks hand you a `req` and `res` and send you on your way.

**QUEST** tells a different story.

Your server is a **Dungeon**. Routes are **Quests**. Middleware are **Spells**. Incoming requests are **Adventurers** — and it's your job to send them off with **Loot** or **Banish** them.

The API is designed to be terse and symbolic: one-liner route registration, two response primitives, and a chainable builder that reads almost like a game script.

---

## 🚀 Quick Start

```bash
node demo.js
# The Hero's Guild is open at http://localhost:3000
```

---

## 📖 API Design

### Creating a Dungeon

```js
const { Dungeon } = require('./index');

const dungeon = new Dungeon({ name: 'My Server' });
dungeon.open(3000);
```

---

### Quests (Routes)

Register a route with a single terse string — method and path combined:

```js
dungeon.quest('GET /heroes/:id', (adventurer, loot, banish) => {
  const hero = findHero(adventurer.params.id);
  if (!hero) return banish(404, 'Hero not found.');
  loot(hero);
});
```

Shorthand methods are also available:

```js
dungeon.get('/heroes', handler);
dungeon.post('/heroes', handler);
dungeon.put('/heroes/:id', handler);
dungeon.delete('/heroes/:id', handler);
```

---

### The Adventurer (Request Object)

Every handler receives an `adventurer` — the parsed request:

| Property | Description | Example |
|---|---|---|
| `adventurer.method` | HTTP method | `'GET'` |
| `adventurer.path` | URL path | `'/heroes/3'` |
| `adventurer.params` | Route params | `{ id: '3' }` |
| `adventurer.query` | Query string | `{ name: 'aria' }` |
| `adventurer.headers` | Request headers | `{ 'content-type': '...' }` |
| `adventurer.body` | Parsed body | `{ name: 'Zara', class: 'Rogue' }` |

---

### Loot (Success Responses)

```js
loot(data)              // 200 JSON
loot(201, data)         // custom status JSON
loot.html('<h1>Hi</h1>')  // HTML response
loot.text('plain text')   // plain text
loot.empty(204)           // no body
```

### Banish (Error Responses)

```js
banish(404, 'Hero not found.')
banish(400, 'Every hero needs a name.')
banish(500, 'An unexpected darkness fell.')
```

---

### Spells (Middleware)

Spells run before every quest handler, in the order they are registered. Each spell must call `next()` to continue the pipeline.

```js
dungeon.spell((adventurer, loot, banish, next) => {
  console.log(`${adventurer.method} ${adventurer.path}`);
  next();
});
```

---

### Vaults (Static Files)

Serve a directory of files at a URL prefix:

```js
dungeon.vault('/public', './public');
// GET /public/style.css → serves ./public/style.css
```

Features:
- Correct MIME types for all common file types
- Auto-serves `index.html` for directory requests
- Blocks `../` path traversal attacks
- Streams files directly — never loads large files into memory

---

### Route Groups

Group routes under a shared prefix:

```js
dungeon.group('/api', (api) => {
  api.quest('GET /heroes', listHeroes);
  api.quest('POST /heroes', createHero);
  api.quest('GET /heroes/:id', getHero);
});
// Registers: GET /api/heroes, POST /api/heroes, GET /api/heroes/:id
```

---

## ✨ Creative Features

### 1. RPG-Themed API
The entire framework vocabulary is RPG-flavoured — Dungeon, Quest, Spell, Vault, Adventurer, Loot, Banish. This makes the code read like a game script and is genuinely fun to write.

### 2. Terse Route Syntax
`dungeon.quest('GET /heroes/:id', handler)` — method and path in one string, no chaining required. Inspired by how concise shell scripts define commands.

### 3. Colorful Dungeon Log
Every request is automatically logged with color-coded HTTP methods, status codes, and response times — all using ANSI escape codes with zero dependencies:

```
[10:42:01] GET     /api/heroes        200  3ms
[10:42:03] POST    /api/heroes        201  1ms
[10:42:05] GET     /api/heroes/99     404  2ms
```

### 4. Built-in Rate Limiter Spell
The demo ships with a rate-limiting spell (100 req/min per IP) implemented entirely as middleware — showing how spells can be used for cross-cutting concerns.

### 5. Route Groups
`dungeon.group('/api', fn)` lets you organise routes under a prefix without repeating it on every quest — keeping large route files clean.

---

## 🗂️ Project Structure

```
quest-framework/
├── index.js          # Public entry point
├── demo.js           # Demo app (Heroes Guild API)
├── package.json
├── public/
│   └── relic.txt     # Sample static file
└── src/
    ├── parser.js     # HTTP/1.1 request parser → adventurer object
    ├── router.js     # QuestBoard — route registry & matching
    ├── response.js   # Response builder (loot, banish, streamRelic)
    ├── static.js     # Static file vault (openVault)
    └── dungeon.js    # Core Dungeon class — ties everything together
```

---

## 🔍 How It Works Under the Hood

1. **TCP Server** — `net.createServer` opens a raw TCP socket
2. **Buffering** — incoming chunks are buffered until a complete HTTP request arrives (checked via `Content-Length`)
3. **Parsing** — `parseAdventurer()` splits the raw buffer into method, path, query, headers, and body
4. **Spell Pipeline** — middleware spells run in sequence via a recursive `next()` chain
5. **Vault Check** — if the path matches a static vault prefix, the file is streamed directly
6. **Quest Match** — the router compares the method + path against registered quest regexes
7. **Response** — `loot()` or `banish()` writes a valid HTTP/1.1 response and closes the socket

---

## 🧪 Demo Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Framework homepage |
| GET | `/api/heroes` | List all heroes |
| GET | `/api/heroes/:id` | Get hero by ID |
| POST | `/api/heroes` | Create a hero (JSON body) |
| PUT | `/api/heroes/:id` | Update a hero |
| DELETE | `/api/heroes/:id` | Banish a hero |
| GET | `/api/dungeon` | Server status |
| GET | `/api/search?name=` | Search heroes by name |
| GET | `/public/*` | Static files from `./public/` |

### Example: Create a Hero

```bash
curl -X POST http://localhost:3000/api/heroes \
  -H "Content-Type: application/json" \
  -d '{"name":"Zara Duskwalker","class":"Rogue"}'
```

```json
{
  "message": "Hero joined the guild!",
  "hero": { "id": 4, "name": "Zara Duskwalker", "class": "Rogue", "level": 1, "hp": 260 }
}
```

---

## 📚 References

- [Node.js `net` Module](https://nodejs.org/docs/latest/api/net.html)
- [HTTP/1.1 Specification — RFC 2616](https://datatracker.ietf.org/doc/html/rfc2616)
- [MDN: HTTP Overview](https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview)

---

*⚔️ QUEST Framework · Built for Full Stack Engineering · Reichman University 2026*