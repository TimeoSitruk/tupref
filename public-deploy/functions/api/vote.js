// Simple in-memory rooms store. This is ephemeral and only intended for
// local/dev/testing. For production, replace with a persistent store.
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

export async function onRequestPost(context) {
  const body = await context.request.json();
  const action = body.action;

  if (action === 'create_room') {
    const items = body.items || [];
    const roomId = genId(6);
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
      votes: {}, // votes[pairIndex] = { playerId: choice }
      nextRoundPlayers: [],
      roundNumber: 1,
      finished: false,
      ready: false, // true when all voted and awaiting creator
      updatedAt: Date.now(),
    };
    return new Response(JSON.stringify({ ok: true, roomId, room: rooms[roomId] }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (action === 'join_room') {
    const items = body.items || [];
    const requestedId = body.roomId && String(body.roomId).trim();
    let roomId = requestedId || genId(6);
    if (requestedId && rooms[requestedId]) {
      return new Response(JSON.stringify({ ok: false, error: 'room_exists' }), { headers: { 'Content-Type': 'application/json' } });
    }
    const name = body.playerName || 'Invité';
    rooms[roomId] = {
    if (!room) return new Response(JSON.stringify({ ok: false, error: 'No such room' }), { headers: { 'Content-Type': 'application/json' } });
      creatorId: playerId,
      players: [{ id: playerId, name: playerName }],
    if (existing) existing.name = name || existing.name;
    else room.players.push({ id: p, name });
    room.updatedAt = Date.now();
    return new Response(JSON.stringify({ ok: true, room }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (action === 'get_state') {
    const roomId = body.roomId;
    const room = rooms[roomId];
    if (!room) return new Response(JSON.stringify({ ok: false, error: 'No such room' }), { headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ ok: true, room }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (action === 'vote') {
    const roomId = body.roomId;
    const playerId = body.playerId || 'anon';
    const choice = body.choice;
    const room = rooms[roomId];
    if (!room) return new Response(JSON.stringify({ ok: false, error: 'No such room' }), { headers: { 'Content-Type': 'application/json' } });
    if (room.finished) return new Response(JSON.stringify({ ok: false, error: 'room finished' }), { headers: { 'Content-Type': 'application/json' } });

    const idx = room.pairIndex;
    if (!room.votes[idx]) room.votes[idx] = {};
    room.votes[idx][playerId] = choice;
    room.updatedAt = Date.now();

    // Check if all players voted for this pair. Require at least 2 players
    const votesForPair = room.votes[idx];
    const voters = Object.keys(votesForPair);
    // tolerate players represented as strings or {id,name}
    const uniquePlayers = Array.from(new Set((room.players || []).map(p => (typeof p === 'string' ? p : (p && p.id))))).filter(Boolean);
    const allVoted = uniquePlayers.length >= 2 && uniquePlayers.every((p) => voters.includes(p));
    if (allVoted) {
      // compute winner (simple majority). On tie pick first.
      const counts = {};
      for (const v of Object.values(votesForPair)) counts[v] = (counts[v] || 0) + 1;
      let winner = null;
      let max = -1;
      for (const [k, c] of Object.entries(counts)) {
        if (c > max) { max = c; winner = k; }
      }

      // store winner for next round candidates but DO NOT advance until creator confirms
      if (!room.nextRoundPlayers) room.nextRoundPlayers = [];
      if (winner !== null) room.nextRoundPlayers.push(winner);
      room.ready = true; // signal that all have voted and results are ready
    }

    return new Response(JSON.stringify({ ok: true, room }), { headers: { 'Content-Type': 'application/json' } });
  }

  if (action === 'next') {
    const roomId = body.roomId;
    const playerId = body.playerId || 'anon';
    const room = rooms[roomId];
    if (!room) return new Response(JSON.stringify({ ok: false, error: 'No such room' }), { headers: { 'Content-Type': 'application/json' } });
    if (room.creatorId !== playerId) return new Response(JSON.stringify({ ok: false, error: 'not allowed' }), { headers: { 'Content-Type': 'application/json' } });
    if (!room.ready) return new Response(JSON.stringify({ ok: false, error: 'not ready' }), { headers: { 'Content-Type': 'application/json' } });

    // advance to next pair
    room.pairIndex = (room.pairIndex || 0) + 1;
    room.ready = false;

    // if finished this round, prepare next round
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
    return new Response(JSON.stringify({ ok: true, room }), { headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ ok: false, error: 'unknown action' }), { headers: { 'Content-Type': 'application/json' } });
}
