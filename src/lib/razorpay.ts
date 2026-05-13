/**
 * Razorpay checkout helper.
 *
 * The Razorpay JS SDK isn't on npm — it's loaded from their CDN.
 * We inject the script once, then open the modal with the order id signed
 * by our backend.
 *
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 */

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export interface RazorpayOptions {
  key: string;
  amount: number; // paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
}

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Failed to load Razorpay'));
    };
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function openRazorpayCheckout(options: RazorpayOptions): Promise<void> {
  await loadScript();
  if (!window.Razorpay) throw new Error('Razorpay SDK unavailable');
  const rzp = new window.Razorpay(options);
  rzp.open();
}
