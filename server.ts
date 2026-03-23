import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Voice chat rooms state
  const rooms: Record<string, Set<string>> = {};
  const userProfiles: Record<string, any> = {};

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-voice', ({ groupId, profile }) => {
      // Normalizar para string — evita salas diferentes (ex.: número vs string do DB)
      const roomName = `voice-${String(groupId)}`;
      socket.join(roomName);
      
      if (!rooms[roomName]) {
        rooms[roomName] = new Set();
      }
      rooms[roomName].add(socket.id);
      userProfiles[socket.id] = profile;

      // Notify others in the room
      socket.to(roomName).emit('user-joined-voice', { 
        socketId: socket.id, 
        profile 
      });

      // Send current users in room to the new user
      const usersInRoom = Array.from(rooms[roomName])
        .filter(id => id !== socket.id)
        .map(id => ({
          socketId: id,
          profile: userProfiles[id]
        }));
      
      socket.emit('current-voice-users', usersInRoom);
    });

    socket.on('leave-voice', ({ groupId }) => {
      const roomName = `voice-${String(groupId)}`;
      socket.leave(roomName);
      
      if (rooms[roomName]) {
        rooms[roomName].delete(socket.id);
        socket.to(roomName).emit('user-left-voice', socket.id);
      }
    });

    // WebRTC signaling
    socket.on('offer', ({ to, offer }) => {
      socket.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
      socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // Admin actions
    socket.on('admin-mute-user', ({ groupId, targetSocketId, mute }) => {
      const roomName = `voice-${String(groupId)}`;
      // Verify if sender is admin (this is a simple check, in production we'd verify with DB)
      // For now we trust the client's request if it comes from an admin UI
      io.to(targetSocketId).emit('muted-by-admin', { mute });
    });

    socket.on('admin-kick-user', ({ groupId, targetSocketId }) => {
      const roomName = `voice-${String(groupId)}`;
      io.to(targetSocketId).emit('kicked-by-admin');
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Clean up rooms
      for (const roomName in rooms) {
        if (rooms[roomName].has(socket.id)) {
          rooms[roomName].delete(socket.id);
          socket.to(roomName).emit('user-left-voice', socket.id);
        }
      }
      delete userProfiles[socket.id];
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
