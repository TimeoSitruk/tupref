import json
import time
from typing import Any, Dict

# In-memory storage (resets on deployment - use a database for persistence)
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


def handler(request):
    """Main handler for Vercel Serverless Functions"""
    try:
        # Handle CORS preflight
        if request.method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                }
            }
        
        if request.method != 'POST':
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': False, 'error': 'Method not allowed'})
            }
        
        # Parse request body
        try:
            if hasattr(request, 'body'):
                body_str = request.body if isinstance(request.body, str) else (request.body.decode('utf-8') if request.body else '{}')
            else:
                body_str = '{}'
            body = json.loads(body_str)
        except Exception as e:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': False, 'error': f'Invalid JSON'})
            }
        
        action = body.get('action')
        
        # CREATE_ROOM
        if action == 'create_room':
            items = body.get('items', [])
            requested = body.get('roomId', '').strip() if isinstance(body.get('roomId'), str) else ''
            room_id = requested if requested else gen_id(6)
            
            if requested and room_id in rooms:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'room_exists'})
                }
            
            pairs = make_pairs(items)
            player_id = body.get('playerId', 'anon')
            player_name = body.get('playerName', 'Hôte')
            
            room_data = {
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
            rooms[room_id] = room_data
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': True, 'roomId': room_id, 'room': room_data})
            }
        
        # JOIN_ROOM
        if action == 'join_room':
            room_id = body.get('roomId')
            p = body.get('playerId', 'anon')
            name = body.get('playerName', 'Invité')
            
            if room_id not in rooms:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'No such room'})
                }
            
            room = rooms[room_id]
            existing = next((x for x in room['players'] if x['id'] == p), None)
            if existing:
                existing['name'] = name or existing.get('name')
            else:
                room['players'].append({'id': p, 'name': name})
            
            room['updatedAt'] = int(time.time() * 1000)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': True, 'room': room})
            }
        
        # GET_STATE
        if action == 'get_state':
            room_id = body.get('roomId')
            if room_id not in rooms:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'No such room'})
                }
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': True, 'room': rooms[room_id]})
            }
        
        # VOTE
        if action == 'vote':
            room_id = body.get('roomId')
            player_id = body.get('playerId', 'anon')
            choice = body.get('choice')
            
            if room_id not in rooms:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'No such room'})
                }
            
            room = rooms[room_id]
            if room.get('finished'):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'room finished'})
                }
            
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
                winner = max(counts.items(), key=lambda x: x[1])[0] if counts else None
                if winner:
                    room.setdefault('nextRoundPlayers', []).append(winner)
                room['ready'] = True
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': True, 'room': room})
            }
        
        # NEXT
        if action == 'next':
            room_id = body.get('roomId')
            player_id = body.get('playerId', 'anon')
            
            if room_id not in rooms:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'No such room'})
                }
            
            room = rooms[room_id]
            if room.get('creatorId') != player_id:
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'not allowed'})
                }
            
            if not room.get('ready'):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': False, 'error': 'not ready'})
                }
            
            room['pairIndex'] = room.get('pairIndex', 0) + 1
            room['ready'] = False
            
            if room['pairIndex'] >= len(room['pairs']):
                next_round = room.get('nextRoundPlayers', [])
                if len(next_round) <= 1:
                    room['finished'] = True
                else:
                    room['roundNumber'] = room.get('roundNumber', 1) + 1
                    room['pairs'] = make_pairs(next_round)
                    room['pairIndex'] = 0
                    room['nextRoundPlayers'] = []
                    room['votes'] = {}
            
            room['updatedAt'] = int(time.time() * 1000)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': True, 'room': room})
            }
        
        # Unknown action
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'unknown action'})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'Server error'})
        }
