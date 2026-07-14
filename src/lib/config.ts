import { api } from './api';

/**
 * Platform feature flags (public read, admin-only write).
 * Backed by GET /api/config — see AppConfig on the backend.
 */
export interface AppFlags {
  /** When false, the customer home hides the "All Products" feed. */
  showAllProducts: boolean;
  /** When false, the login page hides the Phone/OTP sign-in option. */
  enablePhoneLogin: boolean;
  /** When false, the customer page hides the AI voice assistant. */
  enableVoiceAssistant: boolean;
}

const DEFAULT_FLAGS: AppFlags = {
  showAllProducts: true,
  enablePhoneLogin: false,
  enableVoiceAssistant: false,
};

export async function fetchAppFlags(): Promise<AppFlags> {
  try {
    const r = await api<{ flags: Partial<AppFlags> }>('/config');
    return { ...DEFAULT_FLAGS, ...r.flags };
  } catch {
    // If the config endpoint is unreachable, fail open (show products)
    // so a backend hiccup never blanks the storefront.
    return DEFAULT_FLAGS;
  }
}
