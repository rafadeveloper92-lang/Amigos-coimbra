import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Máximo de pessoas por canal de voz (malha WebRTC). */
const MAX_VOICE_PER_CHANNEL = 6;

export type VoiceChannelInfo = { id: string; name: string };

function voiceRoomName(groupId: string | number, channelId: string) {
  return `voice-${String(groupId)}-${channelId}`;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  const PORT = 3000;

  const rooms: Record<string, Set<string>> = {};
  const userProfiles: Record<string, unknown> = {};

  /** Canais por grupo (sincronizado com clientes em voice-meta). */
  const groupVoiceChannels: Record<string, VoiceChannelInfo[]> = {};

  function ensureDefaultChannels(groupId: string) {
    if (!groupVoiceChannels[groupId]) {
      groupVoiceChannels[groupId] = [{ id: 'default', name: 'Geral' }];
    }
  }

  function broadcastChannelList(groupId: string) {
    ensureDefaultChannels(groupId);
    io.to(`voice-meta-${groupId}`).emit('voice-channels-list', {
      groupId,
      channels: groupVoiceChannels[groupId],
    });
  }

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-voice-meta', ({ groupId }: { groupId: string | number }) => {
      const g = String(groupId);
      ensureDefaultChannels(g);
      socket.join(`voice-meta-${g}`);
      socket.emit('voice-channels-list', {
        groupId: g,
        channels: groupVoiceChannels[g],
      });
    });

    socket.on('leave-voice-meta', ({ groupId }: { groupId: string | number }) => {
      socket.leave(`voice-meta-${String(groupId)}`);
    });

    socket.on(
      'create-voice-channel',
      ({ groupId, name }: { groupId: string | number; name?: string }) => {
        const g = String(groupId);
        ensureDefaultChannels(g);
        const id = `ch_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
        const label =
          name?.trim() ||
          `Canal ${groupVoiceChannels[g].filter((c) => c.id !== 'default').length + 1}`;
        groupVoiceChannels[g].push({ id, name: label });
        broadcastChannelList(g);
      },
    );

    socket.on(
      'get-voice-room-count',
      ({
        groupId,
        channelId,
      }: {
        groupId: string | number;
        channelId: string;
      }) => {
        const roomName = voiceRoomName(groupId, channelId);
        const count = rooms[roomName]?.size ?? 0;
        socket.emit('voice-room-count', {
          groupId: String(groupId),
          channelId,
          count,
        });
      },
    );

    socket.on(
      'join-voice',
      ({ groupId, channelId, profile }: { groupId: string | number; channelId: string; profile: unknown }) => {
        const ch = channelId || 'default';
        const roomName = voiceRoomName(groupId, ch);

        if (!rooms[roomName]) {
          rooms[roomName] = new Set();
        }

        if (rooms[roomName].size >= MAX_VOICE_PER_CHANNEL) {
          socket.emit('voice-join-error', {
            code: 'FULL',
            message: `Canal cheio (${MAX_VOICE_PER_CHANNEL}/${MAX_VOICE_PER_CHANNEL}). Crie outro canal.`,
          });
          return;
        }

        socket.join(roomName);
        rooms[roomName].add(socket.id);
        userProfiles[socket.id] = profile;

        socket.to(roomName).emit('user-joined-voice', {
          socketId: socket.id,
          profile,
        });

        const usersInRoom = Array.from(rooms[roomName])
          .filter((id) => id !== socket.id)
          .map((id) => ({
            socketId: id,
            profile: userProfiles[id],
          }));

        socket.emit('current-voice-users', usersInRoom);
        io.to(`voice-meta-${String(groupId)}`).emit('voice-room-count', {
          groupId: String(groupId),
          channelId: ch,
          count: rooms[roomName].size,
        });
      },
    );

    socket.on('leave-voice', ({ groupId, channelId }: { groupId: string | number; channelId?: string }) => {
      const ch = channelId || 'default';
      const roomName = voiceRoomName(groupId, ch);
      socket.leave(roomName);

      if (rooms[roomName]) {
        rooms[roomName].delete(socket.id);
        socket.to(roomName).emit('user-left-voice', socket.id);
        io.to(`voice-meta-${String(groupId)}`).emit('voice-room-count', {
          groupId: String(groupId),
          channelId: ch,
          count: rooms[roomName].size,
        });
      }
    });

    socket.on('offer', ({ to, offer }: { to: string; offer: unknown }) => {
      socket.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }: { to: string; answer: unknown }) => {
      socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }: { to: string; candidate: unknown }) => {
      socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on(
      'admin-mute-user',
      ({
        groupId,
        channelId,
        targetSocketId,
        mute,
      }: {
        groupId: string | number;
        channelId?: string;
        targetSocketId: string;
        mute: boolean;
      }) => {
        void voiceRoomName(groupId, channelId || 'default');
        io.to(targetSocketId).emit('muted-by-admin', { mute });
      },
    );

    socket.on(
      'admin-kick-user',
      ({
        groupId,
        channelId,
        targetSocketId,
      }: {
        groupId: string | number;
        channelId?: string;
        targetSocketId: string;
      }) => {
        void voiceRoomName(groupId, channelId || 'default');
        io.to(targetSocketId).emit('kicked-by-admin');
      },
    );

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const roomName in rooms) {
        if (rooms[roomName].has(socket.id)) {
          rooms[roomName].delete(socket.id);
          socket.to(roomName).emit('user-left-voice', socket.id);
          const m = /^voice-(.+)-(.+)$/.exec(roomName);
          if (m) {
            const groupId = m[1];
            const channelId = m[2];
            io.to(`voice-meta-${groupId}`).emit('voice-room-count', {
              groupId,
              channelId,
              count: rooms[roomName].size,
            });
          }
        }
      }
      delete userProfiles[socket.id];
    });
  });

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
