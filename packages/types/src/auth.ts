export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  /** From register `customIdentity` / user metadata; omitted or `{}` when none. */
  customIdentity?: Record<string, string>;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  customIdentity?: Record<string, string>;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshResponse {
  accessToken: string;
  expiresIn: number;
}

export interface LogoutResponse {
  loggedOut: boolean;
}

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  appId: string;
  createdAt: string;
}
