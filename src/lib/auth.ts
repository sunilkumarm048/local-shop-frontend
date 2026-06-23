import { api } from './api';
import { useAuth } from '@/stores/auth';
import type { User } from '@/types';

type AuthResponse = { user: User; token: string };

export async function loginWithEmail(email: string, password: string) {
  const res = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  useAuth.getState().setAuth(res.user, res.token);
  return res;
}

export async function registerWithEmail(input: {
  name?: string;
  email: string;
  password: string;
  phone?: string;
  role?: 'customer' | 'shop' | 'delivery';
}) {
  const res = await api<AuthResponse>('/auth/register', {
    method: 'POST',
    body: input,
  });
  useAuth.getState().setAuth(res.user, res.token);
  return res;
}

export async function sendOtp(phone: string) {
  return api<{ phone: string; expiresInSeconds: number }>('/auth/otp/send', {
    method: 'POST',
    body: { phone },
  });
}

export async function verifyOtp(input: {
  phone: string;
  code: string;
  name?: string;
  roleHint?: 'customer' | 'shop' | 'delivery';
}) {
  const res = await api<AuthResponse>('/auth/otp/verify', {
    method: 'POST',
    body: input,
  });
  useAuth.getState().setAuth(res.user, res.token);
  return res;
}

export async function refreshMe() {
  const token = useAuth.getState().token;
  if (!token) return null;
  try {
    const { user } = await api<{ user: User }>('/auth/me', { token });
    // Preserve token, update user
    useAuth.setState({ user });
    return user;
  } catch {
    useAuth.getState().clear();
    return null;
  }
}

export interface ProfileUpdate {
  name?: string;
  avatar?: string;
  addresses?: Array<{
    label?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    location?: { lng: number; lat: number };
  }>;
}

export async function updateProfile(input: ProfileUpdate) {
  const token = useAuth.getState().token;
  const { user } = await api<{ user: User }>('/auth/me', {
    method: 'PATCH',
    body: input,
    token,
  });
  useAuth.setState({ user });
  return user;
}

export async function logout() {
  const token = useAuth.getState().token;
  try {
    if (token) await api('/auth/logout', { method: 'POST', token });
  } catch {
    // Best effort
  }
  useAuth.getState().clear();
}

/**
 * Set a new password for the logged-in user (used for the forced first-login
 * change on admin-created accounts). On success, refresh the user so the
 * mustChangePassword flag clears in the store.
 */
export async function changePassword(newPassword: string) {
  const token = useAuth.getState().token;
  await api('/auth/change-password', {
    method: 'POST',
    token,
    body: { newPassword },
  });
  await refreshMe();
}

/** Request a password-reset code to be emailed. */
export async function forgotPassword(email: string) {
  return api<{ ok: boolean; message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

/** Verify the emailed code and set a new password. */
export async function resetPassword(input: {
  email: string;
  code: string;
  newPassword: string;
}) {
  return api<{ ok: boolean; message: string }>('/auth/reset-password', {
    method: 'POST',
    body: input,
  });
}
