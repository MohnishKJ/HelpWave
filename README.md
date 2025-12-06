# HelpWave 🌊

HelpWave is a real-time collaborative help board where users can create or join a room and post doubts instantly. It enables live interaction between participants with real-time updates using WebSockets.

The platform is designed for classrooms, study groups, and collaborative learning environments where quick doubt resolution and interaction are essential.

## 🛠 Tech Stack

### Frontend
- React (Vite)
- JavaScript
- HTML5
- CSS3
- Socket.IO Client

### Backend
- Python
- Flask
- Flask-SocketIO
- SQLAlchemy
- SQLite

### Deployment
- Render (Backend)
- Netlify (Frontend)

### Version Control
- Git
- GitHub

## ✨ Features

- Create and join rooms using a unique room code
- Real-time doubt posting with instant updates
- Live replies on each doubt using WebSockets
- Session persists on page refresh (no auto-logout)
- Manual leave room option for users
- Host controls to end the room for all participants
- Automatic reassignment of host when current host leaves
- Live member count tracking in each room
- Mark doubts as resolved
- Real-time synchronization across all connected users

## 🔗 API Endpoints

### Room Management
- **Create Room**
  - `POST /create-room`
  - Creates a new room and returns a unique room code.

- **Join Room**
  - `POST /join-room`
  - Body: `{ "code": "AB12" }`
  - Verifies and joins an existing room.

- **Get Room Items**
  - `GET /room-items/<room_code>`
  - Fetches all doubts for a specific room.

---

### Doubt Management
- **Create Doubt**
  - `POST /items`
  - Body:
    ```json
    {
      "room_code": "AB12",
      "guest_name": "User",
      "type": "doubt",
      "title": "Sample doubt",
      "description": "Optional description"
    }
    ```

- **Resolve Doubt**
  - `POST /resolve`
  - Body:
    ```json
    {
      "item_id": 1
    }
    ```

---

### Reply System
- **Add Reply**
  - `POST /reply`
  - Body:
    ```json
    {
      "item_id": 1,
      "guest_name": "User",
      "message": "Reply message"
    }
    ```

---

### WebSocket Events (Socket.IO)
- `join_room` → Join a specific room
- `item_created` → Broadcast new doubt
- `item_replied` → Broadcast new reply
- `item_resolved` → Broadcast resolved doubt
- `item_flagged` → Broadcast auto-flagged doubts
- `force_leave_all` → Host ends the room for all
- `member_update` → Live member count update
- `host_changed` → New host assignment

---

## 👤 Owner & Author

**Mohnish KJ**  
Final Year B.E CSE (AI&ML) Student | AI & ML Enthusiast   

- Linkedin: [www.linkedin.com/in/mohnishkj](www.linkedin.com/in/mohnishkj)  
- Project: **HelpWave – Real-Time Collaborative Doubt Board**

This project was designed and developed as a full-stack real-time web application using React, Flask, and Socket.IO.


