from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room
from flask_cors import CORS
from flask_socketio import leave_room
from models import db, Room, HelpItem, Reply
import random
import string
import threading
import time
from datetime import datetime, timedelta, timezone

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///app.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'secret!'

CORS(app)
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')
# --- Live Room Members Tracker ---
room_members = {}  # { room_code: [guest_name1, guest_name2, ...] }

# --- Helpers ---
def generate_room_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))

# --- Background Task ---
def check_old_items():
    """Checks for open items older than 30 mins and flags them."""
    while True:
        with app.app_context():
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
            # Find open, unflagged items created before cutoff
            items_to_flag = HelpItem.query.filter_by(status='open', flagged=False).filter(HelpItem.created_at < cutoff).all()
            
            for item in items_to_flag:
                item.flagged = True
                db.session.add(item)
                # Notify room
                room = Room.query.get(item.room_id)
                if room:
                    socketio.emit('item_flagged', {'item_id': item.id}, room=room.code)
            
            if items_to_flag:
                db.session.commit()
                print(f"Flagged {len(items_to_flag)} items.")
                
        time.sleep(60)

# --- Routes ---

@app.route('/create-room', methods=['POST'])
def create_room():
    data = request.json
    # guest_name = data.get('guest_name') # Not stored in room, just used for joining context if needed
    
    code = generate_room_code()
    while Room.query.filter_by(code=code).first():
        code = generate_room_code()
        
    new_room = Room(code=code)
    db.session.add(new_room)
    db.session.commit()
    
    return jsonify({'code': code})

@app.route('/join-room', methods=['POST'])
def join_room_route():
    data = request.json
    code = data.get('code')
    room = Room.query.filter_by(code=code).first()
    
    if room:
        return jsonify({'success': True, 'code': code})
    return jsonify({'success': False, 'message': 'Room not found'}), 404

# --- Leave Room (MANUAL) ---
@app.route('/leave-room', methods=['POST'])
def leave_room_route():
    data = request.json
    room_code = data.get('room_code')
    guest_name = data.get('guest_name')

    room = Room.query.filter_by(code=room_code).first()
    if not room:
        return jsonify({'success': False, 'message': 'Room not found'}), 404

    # Only emit event (no destructive DB changes)
    socketio.emit(
        'user_left',
        {'guest_name': guest_name},
        room=room_code
    )

    return jsonify({'success': True})

@app.route('/room-items/<code>', methods=['GET'])
def get_room_items(code):
    room = Room.query.filter_by(code=code).first()
    if not room:
        return jsonify({'error': 'Room not found'}), 404
        
    items = (
        HelpItem.query
        .filter_by(room_id=room.id)
        .filter(HelpItem.type != 'blocker')  # Hide all blockers safely
        .order_by(HelpItem.created_at.desc())
        .all()
    )

    return jsonify([i.to_dict() for i in items])

@app.route('/items', methods=['POST'])
def create_item():
    data = request.json
    code = data.get('room_code')
    room = Room.query.filter_by(code=code).first()
    
    if not room:
        return jsonify({'error': 'Room not found'}), 404
        
    item_type = data.get('type')

# --- BLOCKER DISABLED (SAFE OVERRIDE, DO NOT REMOVE DB FIELD) ---
    if item_type == 'blocker':
        item_type = 'doubt'  # Force conversion instead of deleting logic

    new_item = HelpItem(
        room_id=room.id,
        guest_name=data.get('guest_name'),
        type=item_type,
        title=data.get('title'),
        description=data.get('description', '')
    )


    db.session.add(new_item)
    db.session.commit()
    
    socketio.emit('item_created', new_item.to_dict(), room=code)
    return jsonify(new_item.to_dict())

@app.route('/reply', methods=['POST'])
def add_reply():
    data = request.json
    item_id = data.get('item_id')
    item = HelpItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
        
    new_reply = Reply(
        item_id=item.id,
        guest_name=data.get('guest_name'),
        message=data.get('message')
    )
    db.session.add(new_reply)
    db.session.commit()
    
    # Get room code to broadcast
    room = Room.query.get(item.room_id)
    socketio.emit('item_replied', {'item_id': item.id, 'reply': new_reply.to_dict()}, room=room.code)
    
    return jsonify(new_reply.to_dict())

@app.route('/resolve', methods=['POST'])
def resolve_item():
    data = request.json
    item_id = data.get('item_id')
    item = HelpItem.query.get(item_id)
    
    if not item:
        return jsonify({'error': 'Item not found'}), 404
        
    item.status = 'resolved'
    db.session.commit()
    
    room = Room.query.get(item.room_id)
    socketio.emit('item_resolved', {'item_id': item.id}, room=room.code)
    
    return jsonify({'success': True})

# --- Socket Events ---

@socketio.on('join_room')
def on_join(data):
    room_code = data.get('room_code')
    guest_name = data.get('guest_name')

    join_room(room_code)

    # Track members
    if room_code not in room_members:
        room_members[room_code] = []

    room_members[room_code].append(guest_name)

    # Broadcast updated count
    socketio.emit(
        'member_update',
        {
            'count': len(room_members[room_code]),
            'members': room_members[room_code]
        },
        room=room_code
    )

# --- HOST ENDS ROOM FOR ALL USERS ---
@socketio.on('force_leave_all')
def on_force_leave_all(data):
    room_code = data.get('room_code')

    # Clear all members for this room
    room_members.pop(room_code, None)

    socketio.emit('force_leave_all', {}, room=room_code)

@socketio.on('leave_room')
def on_leave(data):
    room_code = data.get('room_code')
    guest_name = data.get('guest_name')

    leave_room(room_code)

    if room_code in room_members and guest_name in room_members[room_code]:
        room_members[room_code].remove(guest_name)

        # If HOST left, promote most recent user
        if len(room_members[room_code]) > 0:
            new_host = room_members[room_code][-1]

            socketio.emit(
                'host_changed',
                { 'new_host': new_host },
                room=room_code
            )

        # Update member count
        socketio.emit(
            'member_update',
            {
                'count': len(room_members[room_code]),
                'members': room_members[room_code]
            },
            room=room_code
        )


if __name__ == '__main__':
    print("Starting HelpWave backend...")
    with app.app_context():
        print("Creating database tables...")
        db.create_all()
        print("Database ready!")
        
    # Start background task
    print("Starting background task...")
    bg_thread = threading.Thread(target=check_old_items, daemon=True)
    bg_thread.start()
    
    print("Starting SocketIO server on port 5000...")
    socketio.run(app, debug=True, host='127.0.0.1', port=5000)
