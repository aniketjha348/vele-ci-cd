import { Server, Socket } from 'socket.io';
import { matchmakingQueue } from './matchmaking';

export const handleVideo = (io: Server, socket: Socket) => {
  // WebRTC signaling
  socket.on('offer', (data: { offer: any; to: string }) => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    console.log('[Video] Offer received:', {
      from: socket.id,
      to: data.to,
      matchSocketId,
      isValid: matchSocketId && matchSocketId === data.to
    });
    if (matchSocketId && matchSocketId === data.to) {
      // Use direct socket access for more reliable delivery
      const targetSocket = io.sockets.sockets.get(data.to);
      if (targetSocket) {
        console.log('[Video] ✅ Sending offer to target socket (direct)');
        targetSocket.emit('offer', {
          offer: data.offer,
          from: socket.id,
        });
      } else {
        console.log('[Video] ⚠️ Target socket not found, using io.to()');
        io.to(data.to).emit('offer', {
          offer: data.offer,
          from: socket.id,
        });
      }
    } else {
      console.warn('[Video] ❌ Invalid offer - match not found or wrong target');
    }
  });

  socket.on('answer', (data: { answer: any; to: string }) => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    console.log('[Video] Answer received:', {
      from: socket.id,
      to: data.to,
      matchSocketId,
      isValid: matchSocketId && matchSocketId === data.to
    });
    if (matchSocketId && matchSocketId === data.to) {
      // Use direct socket access for more reliable delivery
      const targetSocket = io.sockets.sockets.get(data.to);
      if (targetSocket) {
        console.log('[Video] ✅ Sending answer to target socket (direct)');
        targetSocket.emit('answer', {
          answer: data.answer,
          from: socket.id,
        });
      } else {
        console.log('[Video] ⚠️ Target socket not found, using io.to()');
        io.to(data.to).emit('answer', {
          answer: data.answer,
          from: socket.id,
        });
      }
    } else {
      console.warn('[Video] ❌ Invalid answer - match not found or wrong target');
    }
  });

  socket.on('ice-candidate', (data: { candidate: any; to: string }) => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    if (matchSocketId && matchSocketId === data.to) {
      // Use direct socket access for more reliable delivery
      const targetSocket = io.sockets.sockets.get(data.to);
      if (targetSocket) {
        targetSocket.emit('ice-candidate', {
          candidate: data.candidate,
          from: socket.id,
        });
      } else {
        io.to(data.to).emit('ice-candidate', {
          candidate: data.candidate,
          from: socket.id,
        });
      }
    }
  });

  socket.on('video-toggle', (data: { enabled: boolean }) => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    if (matchSocketId) {
      io.to(matchSocketId).emit('peer-video-toggle', {
        enabled: data.enabled,
      });
    }
  });

  socket.on('audio-toggle', (data: { enabled: boolean }) => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    if (matchSocketId) {
      io.to(matchSocketId).emit('peer-audio-toggle', {
        enabled: data.enabled,
      });
    }
  });
};

