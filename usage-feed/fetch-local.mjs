// SPDX-License-Identifier: MIT
// Copyright (c) 2026 David Winter
// Box-side fetcher (fallback/debug): prints feed JSON using CURSOR_TEAM_ADMIN_API_KEY.
import { compute } from './compute.js';
const key = process.env.CURSOR_TEAM_ADMIN_API_KEY;
const r = await fetch('https://api.cursor.com/teams/spend', { method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from(key + ':').toString('base64'), 'Content-Type': 'application/json' },
  body: JSON.stringify({ searchTerm: process.env.SEARCH_TERM }) });
console.log(JSON.stringify(compute(await r.json()), null, 2));
