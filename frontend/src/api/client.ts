const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: opts.method ?? 'GET', headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
  } catch {
    throw new ApiError(0, 'Cannot reach the game server. Is the backend running?');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return (await res.json()) as T;
}

export interface AuthResult { token: string; playerId: string; username: string }
export interface SpeciesInfo { id: string; name: string; category: string; size: string; zones: string[]; description: string }

export const api = {
  register: (username: string, password: string) => request<AuthResult>('/api/auth/register', { method: 'POST', body: { username, password } }),
  login: (username: string, password: string) => request<AuthResult>('/api/auth/login', { method: 'POST', body: { username, password } }),
  getSave: (token: string) => request<{ version: number; data: unknown }>('/api/save', { token }),
  putSave: (token: string, data: unknown) => request<{ status: string }>('/api/save', { method: 'PUT', token, body: { version: 1, data } }),
  startExpedition: (token: string, zone: string, submarine: string) => request<{ expeditionId: string }>('/api/expeditions', { method: 'POST', token, body: { zone, submarine } }),
  recordDiscovery: (token: string, d: { expeditionId?: string; targetId: string; name: string; category: string; zone: string; depth: number }) => request<{ status: string }>('/api/discoveries', { method: 'POST', token, body: d }),
  species: () => request<SpeciesInfo[]>('/api/sim/species'),
  health: () => request<Record<string, string>>('/health'),
};

export const wsUrl = (room: string, token: string) => `${BASE.replace(/^http/, 'ws')}/ws?room=${encodeURIComponent(room)}&token=${encodeURIComponent(token)}`;
