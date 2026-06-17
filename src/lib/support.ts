/**
 * Single source of truth for support contact details.
 *
 * Change these in ONE place when the number, WhatsApp, or email changes
 * (e.g. after the custom domain email is set up). Every SupportCard reads
 * from here, so no hardcoded numbers are scattered across pages.
 */

// Plain national number, shown to the user (call link uses +91).
const SUPPORT_PHONE = '9337583906';

// WhatsApp needs the full international number with country code, no symbols.
const SUPPORT_WHATSAPP_INTL = '919337583906';

export const SUPPORT = {
  /** Display string for the phone number. */
  phoneDisplay: SUPPORT_PHONE,
  /** tel: link target. */
  phoneTel: `+91${SUPPORT_PHONE}`,
  /** wa.me deep link. */
  whatsappUrl: `https://wa.me/${SUPPORT_WHATSAPP_INTL}`,
  /** Support inbox. */
  email: 'localshop098@gmail.com',
};

/**
 * Build a WhatsApp/email prefilled message for a specific order, so support
 * messages arrive with context instead of a blank "hi".
 */
export function supportWhatsappUrl(orderId?: string) {
  if (!orderId) return SUPPORT.whatsappUrl;
  const text = encodeURIComponent(`Hi, I need help with my order #${orderId.slice(-6).toUpperCase()}`);
  return `${SUPPORT.whatsappUrl}?text=${text}`;
}

export function supportMailto(orderId?: string) {
  const subject = orderId
    ? `Support: order #${orderId.slice(-6).toUpperCase()}`
    : 'Support request';
  return `mailto:${SUPPORT.email}?subject=${encodeURIComponent(subject)}`;
}
