import { Server, Socket } from 'socket.io';
import Filter from 'bad-words';
import { matchmakingQueue } from './matchmaking';

const filter = new Filter();

export const handleChat = (io: Server, socket: Socket) => {
  socket.on('send-message', (data: { message: string }) => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);

    if (!matchSocketId) {
      socket.emit('error', { message: 'No active match' });
      return;
    }

    // Moderation
    const isProfane = filter.isProfane(data.message);
    if (isProfane) {
      socket.emit('message-blocked', { reason: 'Profanity detected' });
      return;
    }

    // Echo message back to sender (for confirmation and consistency)
    socket.emit('receive-message', {
      message: data.message,
      timestamp: Date.now(),
      senderId: socket.id, // Sender's own socket ID
    });

    // Send message to matched user (anonymous)
    // Use direct socket access for reliable delivery
    const matchedSocket = io.sockets.sockets.get(matchSocketId);
    if (matchedSocket && matchedSocket.connected) {
      matchedSocket.emit('receive-message', {
        message: data.message,
        timestamp: Date.now(),
        senderId: socket.id, // Only socket ID, not real user ID
      });
    } else {
      // Fallback to room-based emission
      io.to(matchSocketId).emit('receive-message', {
        message: data.message,
        timestamp: Date.now(),
        senderId: socket.id,
      });
    }
  });

  socket.on('typing', () => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    if (matchSocketId) {
      io.to(matchSocketId).emit('user-typing');
    }
  });

  socket.on('stop-typing', () => {
    const matchSocketId = matchmakingQueue.getMatch(socket.id);
    if (matchSocketId) {
      io.to(matchSocketId).emit('user-stopped-typing');
    }
  });
};

