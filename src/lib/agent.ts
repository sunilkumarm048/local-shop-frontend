/**
 * Field-agent onboarding API client (/api/agent/*) — used by the /agent page.
 * Auth is a shared access code sent per-request in the x-agent-code header,
 * not a user account.
 */

import { api } from './api';
import type { quickCreateShop } from './owner';

const CODE_KEY = 'sarvopakar:agent-code';
const NAME_KEY = 'sarvopakar:agent-name';

export function getAgentSession() {
  try {
    return {
      code: localStorage.getItem(CODE_KEY) || '',
      name: localStorage.getItem(NAME_KEY) || '',
    };
  } catch {
    return { code: '', name: '' };
  }
}

export function saveAgentSession(code: string, name: string) {
  try {
    localStorage.setItem(CODE_KEY, code);
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode — session just won't persist */
  }
}

export function clearAgentSession() {
  try {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch {
    /* ignore */
  }
}

/** Same payload/response shape as the admin quickCreateShop — drop-in submitFn. */
export function makeAgentQuickCreate(code: string, agentName: string): typeof quickCreateShop {
  return (payload) =>
    api('/agent/shops/quick-create', {
      method: 'POST',
      headers: { 'x-agent-code': code },
      body: { ...payload, agentName },
    });
}


/** Send the counter-verification code to the owner's email (agent flow). */
export function makeAgentSendEmailOtp(code: string) {
  return async (email: string) => {
    await api<{ ok: boolean }>('/agent/send-email-otp', {
      method: 'POST',
      headers: { 'x-agent-code': code },
      body: { email },
    });
  };
}
