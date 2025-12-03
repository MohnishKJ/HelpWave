import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

// --- Constants ---
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_URL);

function App() {
  // --- State ---
  const [view, setView] = useState('entry');
  const [roomCode, setRoomCode] = useState('');
  const [guestName, setGuestName] = useState('');
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('doubt');
  const [isHost, setIsHost] = useState(false);
  const [memberCount, setMemberCount] = useState(1);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [replyInputs, setReplyInputs] = useState({});

  // --- Restore Session on Refresh ---
  useEffect(() => {
    const savedRoom = localStorage.getItem('roomCode');
    const savedName = localStorage.getItem('guestName');
    const savedView = localStorage.getItem('view');
    const savedHost = localStorage.getItem('isHost');

    if (savedRoom && savedName && savedView === 'board') {
      setRoomCode(savedRoom);
      setGuestName(savedName);
      setIsHost(savedHost === 'true');
      enterRoom(savedRoom, savedName);
    }
  }, []);

  // --- Socket Listeners ---
  useEffect(() => {
    socket.on('item_created', (item) => {
      setItems(prev => [item, ...prev]);
    });

    socket.on('item_replied', ({ item_id, reply }) => {
      setItems(prev =>
        prev.map(item =>
          item.id === item_id
            ? { ...item, replies: [...item.replies, reply] }
            : item
        )
      );
    });

    socket.on('item_resolved', ({ item_id }) => {
      setItems(prev =>
        prev.map(item =>
          item.id === item_id ? { ...item, status: 'resolved' } : item
        )
      );
    });

    socket.on('item_flagged', ({ item_id }) => {
      setItems(prev =>
        prev.map(item =>
          item.id === item_id ? { ...item, flagged: true } : item
        )
      );
    });

    socket.on('member_update', ({ count }) => {
      setMemberCount(count);
    });

    socket.on('host_changed', ({ new_host }) => {
      if (new_host === guestName) {
        setIsHost(true);
        localStorage.setItem('isHost', 'true');
        alert('You are now the host');
      }
    });

    socket.on('force_leave_all', () => {
      alert('Host ended the session');
      localStorage.clear();
      setRoomCode('');
      setGuestName('');
      setItems([]);
      setIsHost(false);
      setView('entry');
    });

    return () => {
      socket.off('item_created');
      socket.off('item_replied');
      socket.off('item_resolved');
      socket.off('item_flagged');
      socket.off('member_update');
      socket.off('host_changed');
      socket.off('force_leave_all');
    };
  }, [guestName]);

  // --- Actions ---

  const createRoom = async () => {
    if (!guestName.trim()) return alert('Please enter your name');
    try {
      const res = await fetch(`${API_URL}/create-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: guestName })
      });

      const data = await res.json();
      setRoomCode(data.code);
      setIsHost(true);
      localStorage.setItem('isHost', 'true');
      enterRoom(data.code, guestName);
    } catch {
      alert('Error creating room');
    }
  };

  const joinRoom = async () => {
    if (!guestName.trim()) return alert('Please enter your name');
    if (!joinCodeInput.trim()) return alert('Please enter room code');

    try {
      const res = await fetch(`${API_URL}/join-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCodeInput })
      });

      const data = await res.json();
      if (!data.success) return alert('Invalid Room Code');

      setRoomCode(data.code);
      setIsHost(false);
      localStorage.setItem('isHost', 'false');
      enterRoom(data.code, guestName);
    } catch {
      alert('Error joining room');
    }
  };

  const enterRoom = async (code, name = guestName) => {
    socket.emit('join_room', {
      room_code: code,
      guest_name: name
    });

    const res = await fetch(`${API_URL}/room-items/${code}`);
    const data = await res.json();

    setItems(data);
    setView('board');

    localStorage.setItem('roomCode', code);
    localStorage.setItem('guestName', name);
    localStorage.setItem('view', 'board');
  };

  const postItem = async (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    await fetch(`${API_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_code: roomCode,
        guest_name: guestName,
        type: 'doubt',
        title: newItemTitle,
        description: newItemDesc
      })
    });

    setNewItemTitle('');
    setNewItemDesc('');
  };

  const sendReply = async (itemId) => {
    const msg = replyInputs[itemId];
    if (!msg?.trim()) return;

    await fetch(`${API_URL}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        guest_name: guestName,
        message: msg
      })
    });

    setReplyInputs(prev => ({ ...prev, [itemId]: '' }));
  };

  const resolveItem = async (itemId) => {
    await fetch(`${API_URL}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId })
    });
  };

  const leaveRoom = () => {
    socket.emit('leave_room', {
      room_code: roomCode,
      guest_name: guestName
    });

    localStorage.clear();
    setRoomCode('');
    setGuestName('');
    setItems([]);
    setIsHost(false);
    setView('entry');
  };

  const endRoomForAll = () => {
    socket.emit('force_leave_all', { room_code: roomCode });
    leaveRoom();
  };

  const filteredItems = items.filter(i => i.status === 'open' && i.type === 'doubt');
  const resolvedItems = items.filter(i => i.status === 'resolved' && i.type === 'doubt');

  // --- Views ---

  if (view === 'entry') {
    return (
      <div className="entry-screen">
        <h1>HelpWave 👋</h1>
        <p>Real-time Doubt Board</p>
        <div className="big-buttons">
          <button className="big-btn primary" onClick={() => setView('create')}>
            Create Room
          </button>
          <button className="big-btn" onClick={() => setView('join')}>
            Join Room
          </button>
        </div>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="entry-screen">
        <div className="form-card">
          <h2>Create a Room</h2>
          <input
            placeholder="Your Display Name"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
          />
          <button className="action-btn" onClick={createRoom}>
            Start Room
          </button>
          <button onClick={() => setView('entry')} style={{ background: 'none', color: '#666' }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="entry-screen">
        <div className="form-card">
          <h2>Join a Room</h2>
          <input
            placeholder="Your Display Name"
            value={guestName}
            onChange={e => setGuestName(e.target.value)}
          />
          <input
            placeholder="Room Code"
            value={joinCodeInput}
            onChange={e => setJoinCodeInput(e.target.value.toUpperCase())}
          />
          <button className="action-btn" onClick={joinRoom}>
            Join Room
          </button>
          <button onClick={() => setView('entry')} style={{ background: 'none', color: '#666' }}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header" style={{ flexDirection: 'column', alignItems: 'center' }}>
        <h2 style={{ textAlign: 'center' }}>HelpWave 🌊</h2>

        <div className="room-info" style={{ marginTop: '8px', textAlign: 'center' }}>
          Room: {roomCode} | You: {guestName} | Members: {memberCount}
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={leaveRoom}
              style={{
                marginRight: '10px',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              Leave Room
            </button>

            {isHost && (
              <button
                onClick={endRoomForAll}
                style={{
                  background: '#000',
                  color: 'white',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                End Room For All
              </button>
            )}
          </div>
        </div>
      </header>

      <form className="create-item-form" onSubmit={postItem}>
        <input
          placeholder="What is your doubt?"
          value={newItemTitle}
          onChange={e => setNewItemTitle(e.target.value)}
        />
        <input
          placeholder="Description (optional)"
          value={newItemDesc}
          onChange={e => setNewItemDesc(e.target.value)}
        />
        <button className="action-btn" type="submit">
          Post Doubt
        </button>
      </form>

      <div className="items-grid">
        {filteredItems.map(item => (
          <div key={item.id} className={`item-card ${item.flagged ? 'flagged' : ''}`}>
            {item.flagged && <div className="flag-label">⚠️ Needs Attention</div>}

            <h3 className="item-title">{item.title}</h3>
            {item.description && <p>{item.description}</p>}
            <div className="item-meta">by {item.guest_name}</div>

            <div className="replies-section">
              {item.replies.map((reply, idx) => (
                <div key={idx} className="reply">
                  <strong>{reply.guest_name}:</strong> {reply.message}
                </div>
              ))}

              <div className="reply-input">
                <input
                  placeholder="Reply..."
                  value={replyInputs[item.id] || ''}
                  onChange={e =>
                    setReplyInputs({ ...replyInputs, [item.id]: e.target.value })
                  }
                  onKeyDown={e => e.key === 'Enter' && sendReply(item.id)}
                />
                <button onClick={() => sendReply(item.id)}>↵</button>
              </div>
            </div>

            <button className="resolve-btn" onClick={() => resolveItem(item.id)}>
              ✓ Mark Resolved
            </button>
          </div>
        ))}
      </div>

      {resolvedItems.length > 0 && (
        <div className="resolved-section">
          <h3>Resolved Items</h3>
          {resolvedItems.map(item => (
            <div key={item.id} className="item-card" style={{ opacity: 0.6 }}>
              <h3>{item.title}</h3>
              <div className="item-meta">by {item.guest_name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
