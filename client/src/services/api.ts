import {
  AuthResponse,
  LoginInput,
  RegisterInput,
  UserDTO,
  RoomSummaryDTO,
  RoomDetailDTO,
  CreateRoomInput,
  FriendSummaryDTO,
  FriendRequestDTO,
  UserSearchDTO,
  QueueItemDTO,
  ChatMessageDTO,
  RoomInvitationDTO,
} from '@syncnshare/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TOKEN_KEY = 'syncnshare_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getStoredToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Send and receive HttpOnly session cookie where supported
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const errorMsg = data?.error?.message || data?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).code = data?.error?.code;
    throw err;
  }

  return data as T;
}

export const api = {
  auth: {
    register: async (input: RegisterInput) => {
      const res = await request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) });
      if (res.token) setStoredToken(res.token);
      return res;
    },
    login: async (input: LoginInput) => {
      const res = await request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
      if (res.token) setStoredToken(res.token);
      return res;
    },
    logout: async () => {
      setStoredToken(null);
      return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
    },
    me: () =>
      request<{ user: UserDTO }>('/auth/me'),
  },

  users: {
    search: (q: string, limit = 10) =>
      request<{ users: UserSearchDTO[] }>(`/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  },

  friends: {
    list: () =>
      request<{ friends: FriendSummaryDTO[] }>('/friends'),
    pending: () =>
      request<{ incoming: FriendRequestDTO[]; outgoing: FriendRequestDTO[] }>('/friends/requests'),
    sendRequest: (recipientId: string) =>
      request<{ request: FriendRequestDTO }>('/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ recipientId }),
      }),
    respondRequest: (requestId: string, action: 'accept' | 'decline') =>
      request<{ ok: boolean; status: string }>(`/friends/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    remove: (friendId: string) =>
      request<{ ok: boolean }>(`/friends/${friendId}`, { method: 'DELETE' }),
  },

  rooms: {
    list: (search?: string) =>
      request<{ rooms: RoomSummaryDTO[] }>(
        `/rooms${search ? `?search=${encodeURIComponent(search)}` : ''}`
      ),
    create: (input: CreateRoomInput) =>
      request<{ room: RoomSummaryDTO }>('/rooms', { method: 'POST', body: JSON.stringify(input) }),
    get: (roomId: string) =>
      request<RoomDetailDTO>(`/rooms/${roomId}`),
    join: (roomId: string, inviteCode?: string) =>
      request<{ ok: boolean; role: string }>(`/rooms/${roomId}/join`, {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      }),
    leave: (roomId: string) =>
      request<{ ok: boolean }>(`/rooms/${roomId}/leave`, { method: 'POST' }),
    invite: (roomId: string, friendUserId: string) =>
      request<{ invitation: RoomInvitationDTO }>(`/rooms/${roomId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ friendUserId }),
      }),
    pendingInvitations: () =>
      request<{ invitations: RoomInvitationDTO[] }>('/rooms/invitations/pending'),
    respondInvitation: (invitationId: string, action: 'accept' | 'decline') =>
      request<{ ok: boolean; roomId: string }>(`/rooms/invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
  },

  queue: {
    get: (roomId: string) =>
      request<{ queue: QueueItemDTO[] }>(`/rooms/${roomId}/queue`),
    add: (roomId: string, url: string) =>
      request<{ item: QueueItemDTO }>(`/rooms/${roomId}/queue`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      }),
    remove: (roomId: string, itemId: string) =>
      request<{ ok: boolean }>(`/rooms/${roomId}/queue/${itemId}`, { method: 'DELETE' }),
    reorder: (roomId: string, itemIds: string[]) =>
      request<{ queue: QueueItemDTO[] }>(`/rooms/${roomId}/queue/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ itemIds }),
      }),
  },

  chat: {
    getMessages: (roomId: string, limit = 50) =>
      request<{ messages: ChatMessageDTO[] }>(`/rooms/${roomId}/messages?limit=${limit}`),
    send: (roomId: string, content: string) =>
      request<{ message: ChatMessageDTO }>(`/rooms/${roomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
  },
};
