export const redisKeys = {
  roomState: (roomId: string) => `room:${roomId}:state`,
  roomPlayers: (roomId: string) => `room:${roomId}:players`,
  roomCalledNumbers: (roomId: string) => `room:${roomId}:calledNumbers`,
  roomPresence: (roomId: string) => `room:${roomId}:presence`,
  roomOffset: (roomId: string) => `room:${roomId}:offset`,
  roomCodeLookup: (roomCode: string) => `room:code:${roomCode}`,
  roomSnapshot: (roomId: string) => `room:${roomId}:snapshot`,
  roomClaimLock: (roomId: string, claimType: string) => `lock:room:${roomId}:claim:${claimType}`,

  // Compatibility keys for legacy code paths.
  roomMeta: (roomId: string) => `room:${roomId}:meta`,
  numQueue: (roomId: string) => `room:${roomId}:numQueue`,
  calledNums: (roomId: string) => `room:${roomId}:calledNums`,
  numHistory: (roomId: string) => `room:${roomId}:numHistory`,
  userTicket: (roomId: string, userId: string) => `room:${roomId}:ticket:${userId}`,
  claimLock: (roomId: string, claimType: string) => `lock:room:${roomId}:claim:${claimType}`,

  rateLimit: (bucket: string, key: string) => `ratelimit:${bucket}:${key}`
};
