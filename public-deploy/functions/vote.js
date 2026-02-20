// Simple in-memory rooms store for multiplayer Tu Préfères
const rooms = {};

function genId(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function makePairs(items) {
  const pairs = [];
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i];
    const b = i + 1 < items.length ? items[i + 1] : null;
    pairs.push([a, b]);
  }
  return pairs;
}

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 400, body: JSON.stringify({ error: 'POST only' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const action = body.action;

  if (action === 'create_room') {
    const items = body.items || [];
    const requestedId = body.roomId && String(body.roomId).trim();
    if (requestedId && rooms[requestedId]) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'room_exists' }) };
    }
    const roomId = requestedId || genId(6);
    const pairs = makePairs(items);
    const playerId = body.playerId || 'anon';
    const playerName = body.playerName || 'Hôte';
    
    rooms[roomId] = {
      id: roomId,
      creatorId: playerId,
      players: [{ id: playerId, name: playerName }],
      items,
      pairs,
      pairIndex: 0,
      votes: {},
      nextRoundPlayers: [],
      roundNumber: 1,
      finished: false,
      ready: false,
      updatedAt: Date.now(),
    };
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ ok: true, roomId, room: rooms[roomId] }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (action === 'join_room') {
    const roomId = body.roomId && String(body.roomId).trim();
    if (!roomId || !rooms[roomId]) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'room_not_found' }) };
    }
    const room = rooms[roomId];
    const playerId = body.playerId || 'anon';
    const playerName = body.playerName || 'Invité';
    
    const existing = (room.players || []).find(p => {
      const pid = (typeof p === 'string') ? p : (p && p.id);
      return pid === playerId;
    });
    if (existing) {
      const pidx = (typeof existing === 'string') ? room.players.indexOf(existing) : room.players.findIndex(p => p && p.id === playerId);
      if (pidx >= 0) room.players[pidx] = { id: playerId, name: playerName };
    } else {
      room.players.push({ id: playerId, name: playerName });
    }
    room.updatedAt = Date.now();
    
    return { 
      statusCode: 200, 
      body: JSON.stringify({ ok: true, room }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (action === 'get_state') {
    const roomId = body.roomId && String(body.roomId).trim();
    const room = rooms[roomId];
    if (!room) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'room_not_found' }) };
    }
    return { 
      statusCode: 200, 
      body: JSON.stringify({ ok: true, room }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (action === 'vote') {
    const roomId = body.roomId && String(body.roomId).trim();
    const playerId = body.playerId || 'anon';
    const choice = body.choice;
    const room = rooms[roomId];
    if (!room) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'room_not_found' }) };
    }
    if (room.finished) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'room_finished' }) };
    }

    const idx = room.pairIndex;
    if (!room.votes[idx]) room.votes[idx] = {};
    room.votes[idx][playerId] = choice;
    room.updatedAt = Date.now();

    const votesForPair = room.votes[idx];
    const voters = Object.keys(votesForPair);
    const uniquePlayers = Array.from(new Set((room.players || []).map(p => (typeof p === 'string' ? p : (p && p.id))))).filter(Boolean);
    const allVoted = uniquePlayers.length >= 2 && uniquePlayers.every(p => voters.includes(p));
    
    if (allVoted) {
      const counts = {};
      for (const v of Object.values(votesForPair)) counts[v] = (counts[v] || 0) + 1;
      let winner = null;
      let max = -1;
      for (const [k, c] of Object.entries(counts)) {
        if (c > max) { max = c; winner = k; }
      }
      if (!room.nextRoundPlayers) room.nextRoundPlayers = [];
      if (winner !== null) room.nextRoundPlayers.push(winner);
      room.ready = true;
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify({ ok: true, room }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  if (action === 'next') {
    const roomId = body.roomId && String(body.roomId).trim();
    const playerId = body.playerId || 'anon';
    const room = rooms[roomId];
    if (!room) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'room_not_found' }) };
    }
    if (room.creatorId !== playerId) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, error: 'not_creator' }) };
    }
    if (!room.ready) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'not_ready' }) };
    }

    room.pairIndex = (room.pairIndex || 0) + 1;
    room.ready = false;

    if (room.pairIndex >= room.pairs.length) {
      if ((room.nextRoundPlayers || []).length <= 1) {
        room.finished = true;
      } else {
        room.roundNumber = (room.roundNumber || 1) + 1;
        room.pairs = makePairs(room.nextRoundPlayers);
        room.pairIndex = 0;
        room.nextRoundPlayers = [];
        room.votes = {};
      }
    }

    room.updatedAt = Date.now();
    return { 
      statusCode: 200, 
      body: JSON.stringify({ ok: true, room }),
      headers: { 'Content-Type': 'application/json' }
    };
  }

  return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'unknown_action' }) };
}
