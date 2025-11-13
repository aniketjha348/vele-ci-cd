import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is required');
}

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle rate limiting errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle 429 (Too Many Requests) with better error message
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const message = retryAfter 
        ? `Too many requests. Please wait ${retryAfter} seconds.`
        : 'Too many requests. Please wait a moment.';
      error.message = message;
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: async (data: { email: string; password: string; username: string }) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  login: async (data: { email: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },
};

export const userAPI = {
  getProfile: async () => {
    const response = await api.get('/user/profile');
    return response.data;
  },
  updateProfile: async (data: { nickname?: string; avatar?: string }) => {
    const response = await api.put('/user/profile', data);
    return response.data;
  },
};

export const subscriptionAPI = {
  getStatus: async () => {
    const response = await api.get('/subscription/status');
    return response.data;
  },
  create: async (tier: 'premium' | 'pro') => {
    const response = await api.post('/subscription/create', { tier });
    return response.data;
  },
  verify: async (data: {
    orderId: string;
    paymentId: string;
    signature: string;
    tier: 'premium' | 'pro';
  }) => {
    const response = await api.post('/subscription/verify', data);
    return response.data;
  },
};

export const gamificationAPI = {
  getStats: async () => {
    const response = await api.get('/gamification/stats');
    return response.data;
  },
  addXP: async (amount: number) => {
    const response = await api.post('/gamification/add-xp', { amount });
    return response.data;
  },
  updateStreak: async () => {
    const response = await api.post('/gamification/update-streak');
    return response.data;
  },
  spinWheel: async () => {
    const response = await api.post('/gamification/spin-wheel');
    return response.data;
  },
};

export const chatAPI = {
  getSkipCount: async () => {
    const response = await api.get('/chat/skip-count');
    return response.data;
  },
  useSkip: async () => {
    const response = await api.post('/chat/skip');
    return response.data;
  },
};

export const reportAPI = {
  reportUser: async (data: { socketId: string; reason: string; description?: string; chatLog?: string[] }) => {
    const response = await api.post('/report/user', data);
    return response.data;
  },
  blockUser: async (data: { socketId: string; userId?: string }) => {
    const response = await api.post('/report/block', data);
    return response.data;
  },
  getBlockedUsers: async () => {
    const response = await api.get('/report/blocked');
    return response.data;
  },
  unblockUser: async (socketId: string) => {
    const response = await api.delete(`/report/block/${socketId}`);
    return response.data;
  },
};

