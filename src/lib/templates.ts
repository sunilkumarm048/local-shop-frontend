import { api } from './api';
import { useAuth } from '@/stores/auth';
import type { Product } from './shops';

function token() {
  return useAuth.getState().token;
}

/**
 * Product template = global catalog entry. Shop owners browse + clone into
 * their store. Lives in DB independent of any shop.
 */
export interface ProductTemplate {
  _id: string;
  name: string;
  weight: string;
  suggestedPrice: number;
  group: string;
  category?: string | { _id: string; name: string } | null;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface TemplatesResponse {
  templates: ProductTemplate[];
  groupCounts: Record<string, number>;
}

export async function fetchTemplates(opts: { group?: string; q?: string; category?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.group) params.set('group', opts.group);
  if (opts.q) params.set('q', opts.q);
  if (opts.category) params.set('category', opts.category);
  return api<TemplatesResponse>(`/templates?${params.toString()}`);
}

// ============================================================
// Clone templates into a shop
// ============================================================

export interface BulkCloneItem {
  templateId: string;
  /** Optional price override; falls back to template.suggestedPrice. */
  price?: number;
  /** Initial stock for the new product. Defaults to 0. */
  stock?: number;
}

export interface BulkCloneSkipped {
  templateId: string;
  reason: string;
}

export interface BulkCloneResponse {
  created: number;
  createdProducts: Product[];
  skipped: BulkCloneSkipped[];
}

export async function cloneFromTemplates(shopId: string, items: BulkCloneItem[]) {
  return api<BulkCloneResponse>(`/shops/${shopId}/products/from-templates`, {
    method: 'POST',
    body: { items },
    token: token(),
  });
}

// ============================================================
// Admin CRUD
// ============================================================

export interface TemplatePayload {
  name: string;
  weight?: string;
  suggestedPrice: number;
  group: string;
  category?: string | null;
  image?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function fetchAdminTemplates() {
  return api<{ templates: ProductTemplate[] }>('/admin/templates', { token: token() });
}

export async function createTemplate(payload: TemplatePayload) {
  return api<{ template: ProductTemplate }>('/admin/templates', {
    method: 'POST',
    body: payload,
    token: token(),
  });
}

export async function updateTemplate(id: string, payload: Partial<TemplatePayload>) {
  return api<{ template: ProductTemplate }>(`/admin/templates/${id}`, {
    method: 'PATCH',
    body: payload,
    token: token(),
  });
}

export async function deleteTemplate(id: string) {
  return api<{ ok: boolean }>(`/admin/templates/${id}`, {
    method: 'DELETE',
    token: token(),
  });
}
