import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

interface QueuedUser {
  socketId: string;
  userId: string;
  preferences?: {
    gender?: 'male' | 'female' | 'any';
    region?: string;
    tier?: 'free' | 'premium' | 'pro';
  };
  timestamp: number;
  waitTime: number; // Time spent waiting (milliseconds)
  blockedUsers?: Set<string>; // Use Set for O(1) lookup
  searchAttempts: number; // Track how many times we've tried to match
}

interface MatchCandidate {
  user: QueuedUser;
  score: number; // Match quality score (higher = better)
  tierMatch: boolean; // Same tier match
  waitTimeBonus: number; // Bonus for waiting longer
}

class MatchmakingQueue {
  // Use Maps and Sets for O(1) lookups instead of O(n) array operations
  private queue: Map<string, QueuedUser> = new Map(); // socketId -> QueuedUser
  private matches: Map<string, string> = new Map(); // socketId -> matched socketId
  private tierBuckets: Map<string, Set<string>> = new Map(); // tier -> Set of socketIds
  private lastMatchAttempt: Map<string, number> = new Map(); // socketId -> last attempt timestamp
  private socketIdToUserId: Map<string, string> = new Map(); // socketId -> userId for blocking checks

  constructor() {
    // Initialize tier buckets
    this.tierBuckets.set('free', new Set());
    this.tierBuckets.set('premium', new Set());
    this.tierBuckets.set('pro', new Set());
  }

  addUser(socketId: string, userId: string, preferences?: any) {
    // Remove if already in queue
    this.removeUser(socketId);

    const tier = preferences?.tier || 'free';
    // Blocked users should be userIds, not socketIds
    // Convert array of userIds to Set for O(1) lookup
    const blockedUsersSet = preferences?.blockedUserIds 
      ? new Set(preferences.blockedUserIds as string[])
      : new Set<string>();

    const user: QueuedUser = {
      socketId,
      userId,
      preferences: {
        ...preferences,
        tier,
      },
      timestamp: Date.now(),
      waitTime: 0,
      blockedUsers: blockedUsersSet, // This Set contains userIds
      searchAttempts: 0,
    };

    // Add to queue
    this.queue.set(socketId, user);
    
    // Store socketId -> userId mapping for blocking checks
    this.socketIdToUserId.set(socketId, userId);
    
    // Add to tier bucket for fast tier-based lookups
    const bucket = this.tierBuckets.get(tier);
    if (bucket) {
      bucket.add(socketId);
    }
  }

  removeUser(socketId: string, keepMatch: boolean = false) {
    const user = this.queue.get(socketId);
    
    // Remove from queue if user exists
    if (user) {
      this.queue.delete(socketId);
      
      // Remove socketId -> userId mapping
      this.socketIdToUserId.delete(socketId);
      
      // Remove from tier bucket
      const tier = user.preferences?.tier || 'free';
      const bucket = this.tierBuckets.get(tier);
      if (bucket) {
        bucket.delete(socketId);
      }
    }

    // CRITICAL: Always clear match entries if keepMatch is false, even if user is not in queue
    // This is needed when users are matched (removed from queue) but then skip and need to requeue
    // The match must be cleared before they can be added back to the queue
    if (!keepMatch) {
      const matchedSocketId = this.matches.get(socketId);
      if (matchedSocketId) {
        console.log(`[Matchmaking] Clearing match for ${socketId} (matched with ${matchedSocketId})`);
        this.matches.delete(socketId);
        this.matches.delete(matchedSocketId);
      }
    }

    // Clean up tracking
    this.lastMatchAttempt.delete(socketId);
  }

  /**
   * Calculate match score for fairness and quality
   * Higher score = better match
   */
  private calculateMatchScore(
    user: QueuedUser,
    candidate: QueuedUser,
    tierMatch: boolean
  ): number {
    let score = 0;

    // Tier match bonus (prefer same tier but allow cross-tier)
    if (tierMatch) {
      score += 100; // Strong preference for same tier
    } else {
      // Cross-tier matching (still allowed but lower priority)
      score += 50;
    }

    // Wait time fairness bonus (users waiting longer get priority)
    const userWaitTime = Date.now() - user.timestamp;
    const candidateWaitTime = Date.now() - candidate.timestamp;
    const avgWaitTime = (userWaitTime + candidateWaitTime) / 2;
    
    // Bonus increases with wait time (max 50 points for 30+ seconds)
    const waitTimeBonus = Math.min(50, avgWaitTime / 600); // 50 points at 30 seconds
    score += waitTimeBonus;

    // Search attempts penalty (prevent users from being skipped repeatedly)
    // Lower attempts = higher priority
    const attemptsPenalty = Math.min(20, candidate.searchAttempts * 2);
    score -= attemptsPenalty;

    // Random factor for fairness (0-10 points)
    score += Math.random() * 10;

    return score;
  }

  /**
   * Check if two users are compatible
   */
  private areCompatible(user: QueuedUser, candidate: QueuedUser): boolean {
    // Basic checks
    if (candidate.socketId === user.socketId) {
      console.log(`[Compatibility] Same socketId: ${user.socketId}`);
      return false;
    }
    if (this.matches.has(candidate.socketId)) {
      console.log(`[Compatibility] Candidate ${candidate.socketId} already matched`);
      return false;
    }

    // Block list check - use userIds, not socketIds
    // blockedUsers Set contains userIds
    if (
      user.blockedUsers?.has(candidate.userId) ||
      candidate.blockedUsers?.has(user.userId)
    ) {
      console.log(`[Compatibility] Blocked: user ${user.userId} blocked ${candidate.userId} or vice versa`);
      return false;
    }

    // Region filter
    const hasRegionFilter = !!(user.preferences?.region && user.preferences.region !== 'any');
    if (hasRegionFilter && user.preferences) {
      const matchRegion = candidate.preferences?.region;
      if (!matchRegion || matchRegion === 'any' || user.preferences.region !== matchRegion) {
        console.log(`[Compatibility] Region mismatch: ${user.preferences.region} vs ${matchRegion}`);
        return false;
      }
    }

    // Gender filter
    const hasGenderFilter = !!(user.preferences?.gender && user.preferences.gender !== 'any');
    if (hasGenderFilter && user.preferences) {
      const matchGender = candidate.preferences?.gender;
      if (!matchGender || matchGender === 'any' || user.preferences.gender !== matchGender) {
        console.log(`[Compatibility] Gender mismatch: ${user.preferences.gender} vs ${matchGender}`);
        return false;
      }
    }

    console.log(`[Compatibility] ✅ Compatible: ${user.socketId} (${user.userId}) <-> ${candidate.socketId} (${candidate.userId})`);
    return true;
  }

  /**
   * Fast matchmaking with tier preference and cross-tier support
   */
  findMatch(socketId: string): QueuedUser | null {
    // Check if user is already matched first
    if (this.isMatched(socketId)) {
      console.log(`[Matchmaking] User ${socketId} is already matched, cannot find new match`);
      return null;
    }
    
    const user = this.queue.get(socketId);
    if (!user) {
      console.log(`[Matchmaking] User ${socketId} not found in queue`);
      return null;
    }

    // Update wait time
    user.waitTime = Date.now() - user.timestamp;
    user.searchAttempts++;
    
    logger.debug(`[Matchmaking] Finding match for ${socketId} (userId: ${user.userId}, tier: ${user.preferences?.tier}, queue size: ${this.queue.size})`);

    const userTier = user.preferences?.tier || 'free';
    const candidates: MatchCandidate[] = [];

    // STRATEGY: Try same tier first, then cross-tier
    // This ensures fairness while maintaining speed

    // Phase 1: Same tier matches (preferred)
    const sameTierBucket = this.tierBuckets.get(userTier);
    if (sameTierBucket) {
      logger.debug(`[Matchmaking] Checking ${sameTierBucket.size} users in same tier (${userTier}), queue size: ${this.queue.size}`);
      
      for (const candidateSocketId of sameTierBucket) {
        if (candidateSocketId === socketId) {
          continue; // Skip self
        }
        
        const candidate = this.queue.get(candidateSocketId);
        if (!candidate) {
          continue; // Candidate not found (might be matched or removed)
        }

        if (this.areCompatible(user, candidate)) {
          const score = this.calculateMatchScore(user, candidate, true);
          logger.debug(`[Matchmaking] ✅ Compatible candidate found: ${candidate.socketId} (score: ${score})`);
          candidates.push({
            user: candidate,
            score,
            tierMatch: true,
            waitTimeBonus: candidate.waitTime,
          });
        }
      }
    }

    // Phase 2: Cross-tier matches (if no same-tier matches or to expand pool)
    // Only add cross-tier if:
    // 1. No same-tier matches found, OR
    // 2. User has been waiting > 10 seconds (to ensure fairness)
    const shouldTryCrossTier = candidates.length === 0 || user.waitTime > 10000;

    if (shouldTryCrossTier) {
      for (const [tier, bucket] of this.tierBuckets.entries()) {
        if (tier === userTier) continue; // Skip same tier (already checked)

        for (const candidateSocketId of bucket) {
          const candidate = this.queue.get(candidateSocketId);
          if (!candidate) continue;

          if (this.areCompatible(user, candidate)) {
            const score = this.calculateMatchScore(user, candidate, false);
            candidates.push({
              user: candidate,
              score,
              tierMatch: false,
              waitTimeBonus: candidate.waitTime,
            });
          }
        }
      }
    }

    // If no candidates found, try relaxed matching (no filters except block list)
    if (candidates.length === 0) {
      logger.debug(`[Matchmaking] No candidates found, trying relaxed matching (queue size: ${this.queue.size})`);
      
      for (const candidate of this.queue.values()) {
        if (candidate.socketId === socketId) continue; // Skip self
        if (this.matches.has(candidate.socketId)) continue; // Skip matched
        
        // Only check block list - use userIds, not socketIds
        if (
          user.blockedUsers?.has(candidate.userId) ||
          candidate.blockedUsers?.has(user.userId)
        ) {
          continue; // Skip blocked
        }

        const tierMatch = candidate.preferences?.tier === userTier;
        const score = this.calculateMatchScore(user, candidate, tierMatch);
        candidates.push({
          user: candidate,
          score,
          tierMatch,
          waitTimeBonus: candidate.waitTime,
        });
      }
      
      if (candidates.length === 0) {
        logger.debug(`[Matchmaking] ⚠️ No candidates found in relaxed matching. Queue size: ${this.queue.size}`);
      }
    }

    // If still no candidates, return null
    if (candidates.length === 0) {
      logger.debug(`[Matchmaking] No candidates found for ${socketId} (queue size: ${this.queue.size})`);
      return null;
    }
    
    logger.debug(`[Matchmaking] Found ${candidates.length} candidates for ${socketId}, selecting best match`);

    // Sort by score (highest first) and select top candidates
    candidates.sort((a, b) => b.score - a.score);

    // Weighted random selection from top candidates
    // This ensures fairness: high-scoring candidates are more likely, but not guaranteed
    const topCandidates = candidates.slice(0, Math.min(5, candidates.length)); // Top 5 candidates
    const totalScore = topCandidates.reduce((sum, c) => sum + c.score, 0);

    // Random selection weighted by score
    let random = Math.random() * totalScore;
    for (const candidate of topCandidates) {
      random -= candidate.score;
      if (random <= 0) {
        return candidate.user;
      }
    }

    // Fallback to highest score candidate
    const selectedMatch = topCandidates[0].user;
    console.log(`[Matchmaking] Selected match for ${socketId}: ${selectedMatch.socketId} (userId: ${selectedMatch.userId})`);
    return selectedMatch;
  }

  createMatch(socketId1: string, socketId2: string) {
    console.log(`[Matchmaking] Creating match between ${socketId1} and ${socketId2}`);
    // Set match FIRST before removing users
    this.matches.set(socketId1, socketId2);
    this.matches.set(socketId2, socketId1);
    
    // Verify match was set
    const matchCount = this.matches.size / 2;
    logger.debug(`[Matchmaking] Match set. Matched pairs: ${matchCount}`);
    
    // Remove both users from queue but KEEP the match entries
    // keepMatch=true prevents removeUser from clearing the match we just created
    this.removeUser(socketId1, true);
    this.removeUser(socketId2, true);
    
    // Verify match still exists after removal
    const finalMatchCount = this.matches.size / 2;
    console.log(`[Matchmaking] Match created. Queue size: ${this.queue.size}, Matched pairs: ${finalMatchCount}`);
    
    if (finalMatchCount === 0) {
      console.error(`[Matchmaking] ERROR: Match was cleared! This should not happen.`);
    }
  }

  isMatched(socketId: string): boolean {
    return this.matches.has(socketId);
  }

  getMatch(socketId: string): string | undefined {
    return this.matches.get(socketId);
  }

  /**
   * Clear a match between two users
   * This is used when a match ends (e.g., user skips)
   */
  clearMatch(socketId1: string, socketId2: string) {
    this.matches.delete(socketId1);
    this.matches.delete(socketId2);
    console.log(`[Matchmaking] Cleared match between ${socketId1} and ${socketId2}`);
  }

  /**
   * Get queue statistics (for monitoring/debugging)
   */
  getStats() {
    return {
      totalUsers: this.queue.size,
      matchedPairs: this.matches.size / 2,
      tierDistribution: {
        free: this.tierBuckets.get('free')?.size || 0,
        premium: this.tierBuckets.get('premium')?.size || 0,
        pro: this.tierBuckets.get('pro')?.size || 0,
      },
      queueUsers: Array.from(this.queue.keys()),
      matchedUsers: Array.from(this.matches.keys()),
    };
  }

  /**
   * Get user's position in queue (for wait time estimation)
   */
  getQueuePosition(socketId: string): number {
    const user = this.queue.get(socketId);
    if (!user) return -1;

    const userTier = user.preferences?.tier || 'free';
    const sameTierBucket = this.tierBuckets.get(userTier);
    
    if (!sameTierBucket) return -1;

    let position = 0;
    for (const candidateSocketId of sameTierBucket) {
      if (candidateSocketId === socketId) break;
      const candidate = this.queue.get(candidateSocketId);
      if (candidate && this.areCompatible(user, candidate)) {
        position++;
      }
    }

    return position;
  }

  /**
   * Get user's wait time (for statistics)
   */
  getUserWaitTime(socketId: string): number {
    const user = this.queue.get(socketId);
    if (!user) return 0;
    return Date.now() - user.timestamp;
  }

  /**
   * Get current queue size (for testing and optimization)
   */
  getQueueSize(): number {
    return this.queue.size;
  }

  /**
   * Get the queue Map (for checking if user exists)
   */
  getQueue(): Map<string, QueuedUser> {
    return this.queue;
  }
}

export const matchmakingQueue = new MatchmakingQueue();

// Store matchmaking intervals per socket to allow stopping them
export const matchmakingIntervals = new Map<string, NodeJS.Timeout | null>();
export const matchmakingCancelled = new Map<string, boolean>();

export const handleMatchmaking = (io: Server, socket: Socket) => {
  let matchmakingInterval: NodeJS.Timeout | null = null;
  let isCancelled = false;
  let checkCount = 0;

  // Store interval and cancelled state
  matchmakingIntervals.set(socket.id, null);
  matchmakingCancelled.set(socket.id, false);

  const checkForMatch = () => {
    if (isCancelled || matchmakingCancelled.get(socket.id)) {
      return;
    }

    // CRITICAL: Check if user is still in queue before trying to find a match
    // This prevents "User not found in queue" errors when user skips and is removed
    const userInQueue = matchmakingQueue.getQueue().has(socket.id);
    if (!userInQueue) {
      console.log(`[Matchmaking] User ${socket.id} not in queue anymore, stopping search`);
      isCancelled = true;
      matchmakingCancelled.set(socket.id, true);
      if (matchmakingInterval) {
        clearTimeout(matchmakingInterval);
        matchmakingInterval = null;
        matchmakingIntervals.set(socket.id, null);
      }
      return;
    }

    // Check if user is already matched (prevent double matching)
    if (matchmakingQueue.isMatched(socket.id)) {
      console.log(`[Matchmaking] User ${socket.id} already matched, stopping search`);
      isCancelled = true;
      matchmakingCancelled.set(socket.id, true);
      if (matchmakingInterval) {
        clearTimeout(matchmakingInterval);
        matchmakingInterval = null;
        matchmakingIntervals.set(socket.id, null);
      }
      return;
    }

    checkCount++;

    const match = matchmakingQueue.findMatch(socket.id);

    if (match) {
      console.log(`[Matchmaking] ✅ Match found for ${socket.id} with ${match.socketId}`);
      
      // CRITICAL: Stop matchmaking for BOTH users immediately
      isCancelled = true;
      matchmakingCancelled.set(socket.id, true);
      matchmakingCancelled.set(match.socketId, true);
      
      // Stop this user's interval
      if (matchmakingInterval) {
        clearTimeout(matchmakingInterval);
        matchmakingInterval = null;
        matchmakingIntervals.set(socket.id, null);
      }
      
      // Stop the matched user's interval if it exists
      const matchedUserInterval = matchmakingIntervals.get(match.socketId);
      if (matchedUserInterval) {
        clearTimeout(matchedUserInterval);
        matchmakingIntervals.set(match.socketId, null);
      }

      matchmakingQueue.createMatch(socket.id, match.socketId);

      // Get user's wait time before removing from queue
      const userWaitTime = matchmakingQueue.getUserWaitTime(socket.id);

      // Notify both users
      console.log(`[Matchmaking] Notifying ${socket.id} about match with ${match.socketId}`);
      socket.emit('match-found', {
        matchSocketId: match.socketId,
        matchUserId: match.userId,
        waitTime: match.waitTime,
      });

      // Get the matched user's socket directly to ensure delivery
      const matchedSocket = io.sockets.sockets.get(match.socketId);
      if (matchedSocket && matchedSocket.connected) {
        console.log(`[Matchmaking] Notifying ${match.socketId} about match with ${socket.id} (direct socket, connected: ${matchedSocket.connected})`);
        matchedSocket.emit('match-found', {
          matchSocketId: socket.id,
          matchUserId: socket.id, // Anonymous - don't reveal real userId
          waitTime: userWaitTime,
        });
        console.log(`[Matchmaking] ✅ Event emitted to ${match.socketId}`);
      } else {
        console.error(`[Matchmaking] ERROR: Matched socket ${match.socketId} not found or not connected! Socket exists: ${!!matchedSocket}, Connected: ${matchedSocket?.connected}`);
        // Fallback: Try room-based emission (Socket.IO automatically creates a room for each socketId)
        console.log(`[Matchmaking] Attempting fallback emission to room: ${match.socketId}`);
        io.to(match.socketId).emit('match-found', {
          matchSocketId: socket.id,
          matchUserId: socket.id,
          waitTime: userWaitTime,
        });
      }

      // Create a room for the match
      socket.join(`match-${socket.id}-${match.socketId}`);
      socket.to(match.socketId).socketsJoin(`match-${socket.id}-${match.socketId}`);
      console.log(`[Matchmaking] Both users joined match room: match-${socket.id}-${match.socketId}`);

      // Remove all matchmaking event listeners to prevent conflicts
      socket.removeAllListeners('cancel-match');
      
      // Stop the matched user's matchmaking handler if it exists
      // Use direct socket access for reliable delivery
      if (matchedSocket) {
        matchedSocket.emit('matchmaking-stopped');
      } else {
        io.to(match.socketId).emit('matchmaking-stopped');
      }
      
      // Reset check count
      checkCount = 0;
      
      console.log(`[Matchmaking] ✅ Match setup complete for ${socket.id} and ${match.socketId}`);
      
      // Stop further matchmaking attempts
      return;
    } else {
      // Keep searching
      const queuePosition = matchmakingQueue.getQueuePosition(socket.id);
      socket.emit('searching', { 
        message: 'Finding a match...',
        queuePosition: queuePosition >= 0 ? queuePosition : undefined,
        checkCount,
      });
    }
  };

  // Adaptive polling interval: faster checks initially, then slower
  // This reduces server load while maintaining responsiveness
  const getPollingInterval = () => {
    const queueSize = matchmakingQueue.getQueueSize();
    
    // If queue is very small (1 user), back off aggressively to save resources
    if (queueSize === 1) {
      // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
      const backoff = Math.min(10000, Math.pow(2, Math.floor(checkCount / 5)) * 1000);
      return backoff;
    }
    
    // For testing with small number of users, check very frequently
    if (queueSize <= 2) {
      // With only 2 users, check every 500ms for instant matching
      return 500;
    }
    if (checkCount < 5) return 1000; // First 5 checks: every 1 second
    if (checkCount < 15) return 2000; // Next 10 checks: every 2 seconds
    return 3000; // After that: every 3 seconds
  };

  // Start with faster interval
  const startMatchmaking = () => {
    if (matchmakingInterval) {
      clearTimeout(matchmakingInterval);
      matchmakingInterval = null;
    }

    checkForMatch(); // Initial check

    // If match was found, checkForMatch will set isCancelled and return early
    if (isCancelled) {
      return;
    }

    const scheduleNext = () => {
      // CRITICAL: Check if cancelled before scheduling next
      if (isCancelled) {
        return;
      }
      
      // Double-check if user is still in queue (not matched)
      if (matchmakingQueue.isMatched(socket.id)) {
        isCancelled = true;
        return;
      }
      
      const interval = getPollingInterval();
      matchmakingInterval = setTimeout(() => {
        if (!isCancelled && !matchmakingCancelled.get(socket.id) && !matchmakingQueue.isMatched(socket.id)) {
          checkForMatch();
          // Only schedule next if not cancelled and not matched
          if (!isCancelled && !matchmakingCancelled.get(socket.id) && !matchmakingQueue.isMatched(socket.id)) {
            scheduleNext();
          }
        }
      }, interval);
      matchmakingIntervals.set(socket.id, matchmakingInterval);
    };

    scheduleNext();
  };

  startMatchmaking();

  // Handle cancellation
  socket.on('cancel-match', () => {
    isCancelled = true;
    matchmakingCancelled.set(socket.id, true);
    if (matchmakingInterval) {
      clearTimeout(matchmakingInterval);
      matchmakingInterval = null;
      matchmakingIntervals.set(socket.id, null);
    }
    matchmakingQueue.removeUser(socket.id);
    socket.emit('match-cancelled');
  });

  // Cleanup on disconnect
  socket.on('disconnect', () => {
    isCancelled = true;
    matchmakingCancelled.set(socket.id, true);
    if (matchmakingInterval) {
      clearTimeout(matchmakingInterval);
      matchmakingInterval = null;
      matchmakingIntervals.set(socket.id, null);
    }
    // Clean up from maps
    matchmakingIntervals.delete(socket.id);
    matchmakingCancelled.delete(socket.id);
    // Don't remove user if they're already matched - let the match continue
    // Only remove if they're still in queue
    if (!matchmakingQueue.isMatched(socket.id)) {
      matchmakingQueue.removeUser(socket.id);
    }
  });
};
