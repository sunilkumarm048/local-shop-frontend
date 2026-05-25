/**
 * Weight + vehicle-fit utilities.
 *
 * Ported from the legacy `weight-utils.js`. Products in the catalog usually
 * have a free-text "weight" field like "500g", "1kg", "2.5L", "5pcs".
 * We parse that into kilograms so we can:
 *
 *   1. Show the total cart weight at checkout.
 *   2. Recommend the smallest vehicle that fits.
 *   3. Warn the customer if they picked a vehicle that's too small.
 *
 * The fallback for items we can't parse is `FALLBACK_KG_PER_UNIT` per piece.
 * Conservative on the heavy side — better to over-estimate weight (suggest
 * a slightly bigger vehicle) than under-estimate (delivery partner can't
 * carry it).
 */

import type { VehicleId } from './transport';

export const FALLBACK_KG_PER_UNIT = 0.3;

/* ============== weight parsing ============== */

/**
 * Parse a free-text weight string into kilograms.
 * Returns the fallback for inputs we can't make sense of.
 *
 * Recognized units (case-insensitive):
 *   kg | kgs | kilo | kilos | kilogram | kilograms      → kg
 *   g  | gm  | gms  | gram  | grams                     → kg / 1000
 *   l  | lt  | ltr  | liter | litre | liters | litres   → kg (1L ≈ 1kg)
 *   ml | mls | milliliter | millilitre                  → kg / 1000
 *   pc | pcs | piece | pack | unit | nos                → FALLBACK × count
 */
export function parseWeightKg(weightStr?: string | null): number {
  if (!weightStr || typeof weightStr !== 'string') return FALLBACK_KG_PER_UNIT;
  const s = weightStr.toLowerCase().trim();

  const numMatch = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!numMatch) return FALLBACK_KG_PER_UNIT;
  const num = parseFloat(numMatch[1].replace(',', '.'));
  if (Number.isNaN(num) || num <= 0) return FALLBACK_KG_PER_UNIT;

  if (/\b(kg|kgs|kilo|kilos|kilogram|kilograms)\b/.test(s) || /\d\s*kg/.test(s)) return num;
  if (/\b(g|gm|gms|gram|grams)\b/.test(s) || /\d\s*g(?![a-z])/.test(s)) return num / 1000;
  if (/\b(l|lt|ltr|liter|liters|litre|litres)\b/.test(s) || /\d\s*l(?![a-z])/.test(s)) return num;
  if (/\b(ml|mls|milliliter|millilitre)\b/.test(s)) return num / 1000;
  if (/\b(pc|pcs|piece|pieces|pack|packs|unit|units|nos|no)\b/.test(s)) {
    return num * FALLBACK_KG_PER_UNIT;
  }

  // Bare number with no unit — assume pieces.
  return num * FALLBACK_KG_PER_UNIT;
}

/* ============== cart aggregation ============== */

export interface WeighedCartItem {
  qty: number;
  weight?: string | null;
}

export function getCartWeightKg(items: WeighedCartItem[]): number {
  let total = 0;
  for (const item of items) {
    const perUnitKg = parseWeightKg(item.weight);
    total += perUnitKg * (item.qty || 1);
  }
  // Round to 2 decimals — display value, internal compare uses raw.
  return Math.round(total * 100) / 100;
}

/* ============== vehicle fit ============== */

/**
 * Fallback caps if the live PricingConfig isn't available client-side. These
 * match the seeded defaults on the backend.
 */
const FALLBACK_VEHICLE_CAPS: Record<VehicleId, number> = {
  bike: 10,
  '3wheeler': 500,
  tataAce: 750,
  pickup8ft: 1250,
  tata407: 2500,
};

/**
 * Ordered from smallest to largest — `getRecommendedVehicle` walks this in
 * order and returns the first one whose capacity meets the weight.
 */
const VEHICLE_ORDER: VehicleId[] = ['bike', '3wheeler', 'tataAce', 'pickup8ft', 'tata407'];

/**
 * Pick the smallest vehicle that can carry `weightKg`.
 * Falls back to the largest if nothing fits (so we don't return null).
 *
 * `caps` lets the caller pass live capacity values from PricingConfig; if
 * omitted we use the static fallbacks.
 */
export function getRecommendedVehicle(
  weightKg: number,
  caps: Partial<Record<VehicleId, number>> = {}
): VehicleId {
  const effectiveCaps = { ...FALLBACK_VEHICLE_CAPS, ...caps };
  for (const id of VEHICLE_ORDER) {
    if (weightKg <= effectiveCaps[id]) return id;
  }
  return 'tata407'; // > 2500kg, send the biggest
}

/** Does the chosen vehicle have enough capacity for the weight? */
export function vehicleFits(
  vehicleId: VehicleId,
  weightKg: number,
  caps: Partial<Record<VehicleId, number>> = {}
): boolean {
  const effectiveCaps = { ...FALLBACK_VEHICLE_CAPS, ...caps };
  const cap = effectiveCaps[vehicleId];
  return cap != null && weightKg <= cap;
}

export const VEHICLE_DISPLAY: Record<VehicleId, { name: string; icon: string }> = {
  bike: { name: '2-Wheeler', icon: '🛵' },
  '3wheeler': { name: '3-Wheeler', icon: '🛺' },
  tataAce: { name: 'Tata Ace', icon: '🚐' },
  pickup8ft: { name: 'Pickup 8ft', icon: '🚛' },
  tata407: { name: 'Tata 407', icon: '🚚' },
};
