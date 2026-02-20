import json
import time
from typing import Any, Dict

# In-memory storage (note: resets on deployment, use a database for persistence)
rooms: Dict[str, Any] = {}


def gen_id(length: int = 6) -> str:
    import random
    chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return ''.join(random.choice(chars) for _ in range(length))


def make_pairs(items: list) -> list:
    pairs = []
    for i in range(0, len(items), 2):
        a = items[i]
        b = items[i + 1] if i + 1 < len(items) else None
        pairs.append([a, b])
    return pairs


def success_response(data: dict, status_code: int = 200) -> dict:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': json.dumps(data)
    }


def error_response(error: str, status_code: int = 400) -> dict:
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'ok': False, 'error': error})
    }


def handler(request):
    """Handle HTTP requests for the vote API"""
    # Handle OPTIONS for CORS
    if request.method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }

    if request.method != 'POST':
        return error_response('Method not allowed', 405)

    try:
        body = json.loads(request.body) if request.body else {}
    except Exception:
        return error_response('Invalid JSON', 400)

    action = body.get('action')

    # CREATE_ROOM
    if action == 'create_room':
        items = body.get('items', [])
        requested = body.get('roomId')
        room_id = requested.strip() if isinstance(requested, str) and requested.strip() else gen_id(6)
        
        if requested and room_id in rooms:
            return error_response('room_exists', 400)

        pairs = make_pairs(items)
        player_id = body.get('playerId', 'anon')
        player_name = body.get('playerName', 'Hôte')
        
        rooms[room_id] = {
            'id': room_id,
            'creatorId': player_id,
            'players': [{'id': player_id, 'name': player_name}],
            'items': items,
            'pairs': pairs,
            'pairIndex': 0,
            'votes': {},
            'nextRoundPlayers': [],
            'roundNumber': 1,
            'finished': False,
            'ready': False,
            'updatedAt': int(time.time() * 1000),
        }
        
        resp = {'ok': True, 'roomId': room_id, 'room': rooms[room_id]}
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(resp)
        }

    # JOIN_ROOM
    if action == 'join_room':
        room_id = body.get('roomId')
        p = body.get('playerId', 'anon')
        name = body.get('playerName', 'Invité')
        room = rooms.get(room_id)
        
        if not room:
            return error_response('No such room', 404)

        existing = next((x for x in room['players'] if x['id'] == p), None)
        if existing:
            existing['name'] = name or existing.get('name')
        else:
            room['players'].append({'id': p, 'name': name})

        room['updatedAt'] = int(time.time() * 1000)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'ok': True, 'room': room})
        }

    # GET_STATE
    if action == 'get_state':
        room_id = body.get('roomId')
        room = rooms.get(room_id)
        
        if not room:
            return error_response('No such room', 404)

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'ok': True, 'room': room})
        }

    # VOTE
    if action == 'vote':
        room_id = body.get('roomId')
        player_id = body.get('playerId', 'anon')
        choice = body.get('choice')
        room = rooms.get(room_id)
        
        if not room:
            return error_response('No such room', 404)

        if room.get('finished'):
            return error_response('room finished', 400)

        idx = room.get('pairIndex', 0)
        if idx not in room['votes']:
            room['votes'][idx] = {}
        room['votes'][idx][player_id] = choice
        room['updatedAt'] = int(time.time() * 1000)

        votes_for_pair = room['votes'][idx]
        voters = list(votes_for_pair.keys())
        
        unique_players = []
        for p in room.get('players', []):
            if isinstance(p, str):
                unique_players.append(p)
            elif isinstance(p, dict) and 'id' in p:
                unique_players.append(p['id'])
        
        unique_players = list(dict.fromkeys([x for x in unique_players if x]))
        all_voted = (len(unique_players) >= 2) and all(p in voters for p in unique_players)
        
        if all_voted:
            counts = {}
            for v in votes_for_pair.values():
                counts[v] = counts.get(v, 0) + 1
            winner = None
            maxc = -1
            for k, c in counts.items():
                if c > maxc:
                    maxc = c
                    winner = k
            if winner is not None:
                room.setdefault('nextRoundPlayers', []).append(winner)
            room['ready'] = True

        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'ok': True, 'room': room})
        }

    # NEXT
    if action == 'next':
        room_id = body.get('roomId')
        player_id = body.get('playerId', 'anon')
        room = rooms.get(room_id)
        
        if not room:
            return error_response('No such room', 404)

        if room.get('creatorId') != player_id:
            return error_response('not allowed', 403)

        if not room.get('ready'):
            return error_response('not ready', 400)

        room['pairIndex'] = room.get('pairIndex', 0) + 1
        room['ready'] = False

        if room['pairIndex'] >= len(room['pairs']):
            if len(room.get('nextRoundPlayers', [])) <= 1:
                room['finished'] = True
            else:
                room['roundNumber'] = room.get('roundNumber', 1) + 1
                room['pairs'] = make_pairs(room['nextRoundPlayers'])
                room['pairIndex'] = 0
                room['nextRoundPlayers'] = []
                room['votes'] = {}

        room['updatedAt'] = int(time.time() * 1000)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'ok': True, 'room': room})
        }

    return error_response('unknown action', 400)
