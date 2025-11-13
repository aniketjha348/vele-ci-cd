import { Server } from 'socket.io';
import { matchmakingQueue, handleMatchmaking, matchmakingIntervals, matchmakingCancelled } from './matchmaking';
import { handleChat } from './chat';
import { handleVideo } from './video';
import Block from '../models/Block';

export const setupSocketIO = (io: Server) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Matchmaking - fetch blocked users before adding to queue
    socket.on('find-match', async (data: { userId: string; preferences?: any }) => {
      console.log(`[Matchmaking] 🔍 FIND-MATCH EVENT: User ${data.userId} (socket: ${socket.id}) requesting match`);
      console.log(`[Matchmaking] Current queue state: size=${matchmakingQueue.getQueueSize()}, matched=${matchmakingQueue.getStats().matchedPairs}`);
      
      // CRITICAL: Clear any existing match before adding to queue
      // This ensures users can requeue after skipping
      if (matchmakingQueue.isMatched(socket.id)) {
        const existingMatch = matchmakingQueue.getMatch(socket.id);
        if (existingMatch) {
          console.log(`[Matchmaking] ⚠️ User ${socket.id} still has a match with ${existingMatch}, clearing it...`);
          matchmakingQueue.clearMatch(socket.id, existingMatch);
        }
      }
      
      try {
        // Fetch blocked user IDs from database
        const blocks = await Block.find({ blockerId: data.userId }).select('blockedUserId');
        const blockedUserIds = blocks
          .map(block => block.blockedUserId)
          .filter((id): id is string => !!id); // Filter out undefined values

        console.log(`[Matchmaking] User ${data.userId} has ${blockedUserIds.length} blocked users`);

        // Add blocked user IDs to preferences
        const preferences = {
          ...data.preferences,
          blockedUserIds, // Pass userIds, not socketIds
        };

        if (!socket.id) {
          console.error('[Matchmaking] Socket ID is undefined');
          return;
        }

        matchmakingQueue.addUser(socket.id, data.userId, preferences);
        const newQueueSize = matchmakingQueue.getQueueSize();
        console.log(`[Matchmaking] ✅ Added user ${data.userId} (socket: ${socket.id}) to queue. NEW Queue size: ${newQueueSize}`);
        console.log(`[Matchmaking] Queue users: ${Object.entries(matchmakingQueue.getStats().tierDistribution).map(([tier, count]) => `${tier}=${count}`).join(', ')}`);
        handleMatchmaking(io, socket);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
        // Continue without blocked users if fetch fails
        if (!socket.id) {
          console.error('[Matchmaking] Socket ID is undefined');
          return;
        }
        matchmakingQueue.addUser(socket.id, data.userId, data.preferences);
        console.log(`[Matchmaking] Added user ${data.userId} to queue (without blocked users). Queue size: ${matchmakingQueue.getQueueSize()}`);
        handleMatchmaking(io, socket);
      }
    });

    socket.on('cancel-match', () => {
      matchmakingQueue.removeUser(socket.id);
      socket.emit('match-cancelled');
    });

    socket.on('skip', (data: { userId?: string; preferences?: any; autoRequeue?: boolean }) => {
      console.log(`[Skip] Received skip event from ${socket.id}:`, { 
        userId: data?.userId, 
        autoRequeue: data?.autoRequeue,
        hasPreferences: !!data?.preferences 
      });
      const matchSocketId = matchmakingQueue.getMatch(socket.id);
      
      if (matchSocketId) {
        // CRITICAL: Notify BOTH users immediately that match is ending
        // This ensures proper cleanup on both sides
        
        // Notify the other user that they were skipped
        // Use direct socket access for reliable delivery
        const matchedSocket = io.sockets.sockets.get(matchSocketId);
        if (matchedSocket) {
          // Get the matched user's data for auto-requeue
          // We need to fetch their userId and preferences for requeue
          // For now, we'll let the client handle requeue with their own data
          matchedSocket.emit('match-ended', { 
            reason: 'skipped',
            autoRequeue: true, // Other user also auto-requeues to find new match
            fromSocketId: socket.id,
            disconnected: true, // Explicit disconnect flag
          });
        } else {
          // Fallback to room-based emission
          io.to(matchSocketId).emit('match-ended', { 
            reason: 'skipped',
            autoRequeue: true, // Other user also auto-requeues
            fromSocketId: socket.id,
            disconnected: true,
          });
        }
        
        // Notify this user too (for consistency)
        socket.emit('match-ended', {
          reason: 'skipped',
          autoRequeue: data?.autoRequeue || false,
          fromSocketId: socket.id,
          disconnected: true,
        });
        
        // CRITICAL: Stop matchmaking intervals for both users BEFORE clearing match
        // This prevents "User not found in queue" errors
        const skippingUserInterval = matchmakingIntervals.get(socket.id);
        const matchedUserInterval = matchmakingIntervals.get(matchSocketId);
        
        if (skippingUserInterval) {
          clearTimeout(skippingUserInterval);
          matchmakingIntervals.set(socket.id, null);
          matchmakingCancelled.set(socket.id, true);
          console.log(`[Skip] Stopped matchmaking interval for ${socket.id}`);
        }
        
        if (matchedUserInterval) {
          clearTimeout(matchedUserInterval);
          matchmakingIntervals.set(matchSocketId, null);
          matchmakingCancelled.set(matchSocketId, true);
          console.log(`[Skip] Stopped matchmaking interval for ${matchSocketId}`);
        }
        
        // CRITICAL: Clear the match entries FIRST before removing from queue
        // This ensures users can be requeued properly
        console.log(`[Skip] Clearing match between ${socket.id} and ${matchSocketId}`);
        matchmakingQueue.clearMatch(socket.id, matchSocketId);
        
        // Remove from queue if they're still there (they shouldn't be after createMatch)
        // But we'll ensure they're removed anyway
        if (matchmakingQueue.isMatched(socket.id) || matchmakingQueue.isMatched(matchSocketId)) {
          console.warn(`[Skip] Match still exists after clearMatch! Forcing removal...`);
          // Force remove if still in queue
          matchmakingQueue.removeUser(socket.id, false);
          matchmakingQueue.removeUser(matchSocketId, false);
        }
        
        // Leave the match room to ensure clean disconnection
        socket.leave(`match-${socket.id}-${matchSocketId}`);
        socket.to(matchSocketId).socketsLeave(`match-${socket.id}-${matchSocketId}`);
        
        // If autoRequeue is true, automatically add user back to queue and start searching
        // CRITICAL: Server-side auto-requeue happens here, but we also need to ensure
        // the client doesn't try to requeue via match-ended event to avoid double-requeue
        if (data?.autoRequeue && data?.userId) {
          console.log(`[Skip] ✅ Auto-requeue requested for ${socket.id} (userId: ${data.userId})`);
          // Delay to ensure previous match is fully cleaned up
          setTimeout(async () => {
            // Verify match is cleared before requeueing
            const stillMatched = matchmakingQueue.getMatch(socket.id);
            if (stillMatched) {
              console.error(`[Skip] ERROR: User ${socket.id} still marked as matched! Clearing forcefully...`);
              matchmakingQueue.removeUser(socket.id, false);
            }
            
            // Now safe to requeue
            if (!matchmakingQueue.getMatch(socket.id)) {
              console.log(`[Skip] Re-adding user ${socket.id} to queue for auto-requeue`);
              try {
                // Fetch blocked user IDs again for requeue
                const blocks = await Block.find({ blockerId: data.userId }).select('blockedUserId');
                const blockedUserIds = blocks
                  .map(block => block.blockedUserId)
                  .filter((id): id is string => !!id);

                const preferences = {
                  ...data.preferences,
                  blockedUserIds,
                };

                const socketId = socket.id;
                if (!socketId || !data.userId) {
                  console.error('[Skip] Socket ID or user ID is undefined');
                  return;
                }

                matchmakingQueue.addUser(socketId, data.userId, preferences);
                const queueSize = matchmakingQueue.getQueueSize();
                console.log(`[Skip] ✅ User ${socket.id} re-added to queue. Queue size: ${queueSize}`);
                handleMatchmaking(io, socket);
                socket.emit('skip-success', { autoRequeue: true });
              } catch (error) {
                console.error('[Skip] Error fetching blocked users for requeue:', error);
                // Continue without blocked users if fetch fails
                const socketId = socket.id;
                if (!socketId || !data.userId) {
                  console.error('[Skip] Socket ID or user ID is undefined');
                  return;
                }
                matchmakingQueue.addUser(socketId, data.userId, data.preferences);
                const queueSize = matchmakingQueue.getQueueSize();
                console.log(`[Skip] ✅ User ${socket.id} re-added to queue (without blocked users). Queue size: ${queueSize}`);
                handleMatchmaking(io, socket);
                socket.emit('skip-success', { autoRequeue: true });
              }
            } else {
              console.warn(`[Skip] ⚠️ Cannot requeue ${socket.id} - still marked as matched`);
            }
          }, 200);
        } else {
          console.log(`[Skip] ❌ Auto-requeue NOT requested for ${socket.id} (autoRequeue: ${data?.autoRequeue}, userId: ${data?.userId})`);
        }
      } else {
        // Not in a match, just remove from queue
        matchmakingQueue.removeUser(socket.id);
        socket.emit('match-ended', { reason: 'skipped', autoRequeue: false });
      }
    });

    // Chat
    handleChat(io, socket);

    // Video
    handleVideo(io, socket);

    socket.on('disconnect', () => {
      matchmakingQueue.removeUser(socket.id);
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};

