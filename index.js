/**
 * ⚔️  QUEST Framework
 *
 * A creative HTTP framework built on Node.js's raw net module.
 * No dependencies. No http module. Just TCP and imagination.
 *
 * Quick start:
 *
 *   const { Dungeon } = require('./index');
 *
 *   const dungeon = new Dungeon({ name: 'My Server' });
 *
 *   dungeon.quest('GET /hello', (adventurer, loot) => {
 *     loot({ message: 'Welcome, adventurer!' });
 *   });
 *
 *   dungeon.open(3000);
 */

'use strict';

const { Dungeon }   = require('./src/dungeon');
const { openVault } = require('./src/static');

module.exports = { Dungeon, openVault };