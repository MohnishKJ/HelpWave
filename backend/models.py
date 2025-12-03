from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

class Room(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(10), unique=True, nullable=False)
    items = db.relationship('HelpItem', backref='room', lazy=True)

class HelpItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('room.id'), nullable=False)
    guest_name = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'doubt' or 'blocker'
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='open')  # 'open' or 'resolved'
    flagged = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    replies = db.relationship('Reply', backref='item', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'room_id': self.room_id,
            'guest_name': self.guest_name,
            'type': self.type,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'flagged': self.flagged,
            'created_at': self.created_at.isoformat(),
            'replies': [r.to_dict() for r in self.replies]
        }

class Reply(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey('help_item.id'), nullable=False)
    guest_name = db.Column(db.String(50), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'item_id': self.item_id,
            'guest_name': self.guest_name,
            'message': self.message,
            'created_at': self.created_at.isoformat()
        }
