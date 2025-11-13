import Filter from 'bad-words';

const filter = new Filter();

export const moderateMessage = (message: string): { allowed: boolean; reason?: string } => {
  // Profanity check
  if (filter.isProfane(message)) {
    return { allowed: false, reason: 'Profanity detected' };
  }

  // Basic sentiment check (simplified - can be enhanced with VADER later)
  const negativeWords = ['hate', 'kill', 'die', 'stupid', 'idiot'];
  const lowerMessage = message.toLowerCase();
  const hasNegativeWords = negativeWords.some(word => lowerMessage.includes(word));
  
  if (hasNegativeWords) {
    // Log for moderation review but allow for now
    console.log('Potentially negative message detected:', message);
  }

  return { allowed: true };
};

export const generateNickname = (): string => {
  const adjectives = ['Swift', 'Mystic', 'Cosmic', 'Neon', 'Cyber', 'Quantum', 'Digital', 'Virtual'];
  const nouns = ['Phoenix', 'Wolf', 'Eagle', 'Dragon', 'Tiger', 'Falcon', 'Shark', 'Lion'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 9999);
  
  return `${adjective}${noun}${number}`;
};

