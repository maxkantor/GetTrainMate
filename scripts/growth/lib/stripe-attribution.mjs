/**
 * GetTrainMate Stripe ownership / allowlist for growth revenue.
 * Never treat account-wide Stripe totals as this product's revenue.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALLOWLIST_PATH = path.join(__dirname, '../config/stripe-allowlist.json');

function splitCsv(envVal) {
  if (!envVal || typeof envVal !== 'string') return [];
  return envVal
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function loadStripeAllowlist() {
  const raw = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const productIds = new Set([
    ...(raw.productIds || []),
    ...splitCsv(process.env[raw.productIdsEnv] || process.env.STRIPE_GTM_PRODUCT_IDS)
  ]);
  const priceIds = new Set([
    ...(raw.priceIds || []),
    ...splitCsv(process.env[raw.priceIdsEnv] || process.env.STRIPE_GTM_PRICE_IDS)
  ]);
  const paymentLinkIds = new Set([
    ...(raw.paymentLinkIds || []),
    ...splitCsv(process.env[raw.paymentLinkIdsEnv] || process.env.STRIPE_GTM_PAYMENT_LINK_IDS)
  ]);
  const excludeCustomerIds = new Set([
    ...(raw.excludeCustomerIds || []),
    ...splitCsv(process.env[raw.excludeCustomerIdsEnv] || process.env.STRIPE_GTM_EXCLUDE_CUSTOMER_IDS)
  ]);

  return {
    ...raw,
    productIds,
    priceIds,
    paymentLinkIds,
    excludeCustomerIds,
    appSourceKey: raw.metadata?.appSourceKey || 'gtm_source',
    appSourceValue: raw.metadata?.appSourceValue || 'gettrainmate',
    legacyCreditsKeysAllOf: raw.metadata?.legacyCreditsKeysAllOf || ['packKey', 'credits', 'priceUsd']
  };
}

function meta(obj) {
  return obj?.metadata && typeof obj.metadata === 'object' ? obj.metadata : {};
}

function hasForeignAppSource(m, appSourceKey, appSourceValue) {
  const foreignKeys = ['app_source', 'product_source', 'yb_source', 'source_app', 'application'];
  for (const k of foreignKeys) {
    if (k === appSourceKey) continue;
    const v = m[k];
    if (typeof v === 'string' && v.trim() && !stringEquals(v, appSourceValue)) return true;
  }
  const src = m[appSourceKey];
  if (typeof src === 'string' && src.trim() && !stringEquals(src, appSourceValue)) return true;
  return false;
}

function stringEquals(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

function sessionLinePriceIds(session) {
  const ids = [];
  const data = session?.line_items?.data;
  if (!Array.isArray(data)) return ids;
  for (const li of data) {
    const price = li.price?.id || li.price;
    if (typeof price === 'string' && price.startsWith('price_')) ids.push(price);
    const product = li.price?.product;
    if (typeof product === 'string' && product.startsWith('prod_')) ids.push(product);
  }
  return ids;
}

/**
 * @returns {{ attributed: boolean, reason: string }}
 */
export function classifyStripeObject(obj, allowlist = loadStripeAllowlist()) {
  const m = meta(obj);
  const {
    appSourceKey,
    appSourceValue,
    legacyCreditsKeysAllOf,
    productIds,
    priceIds,
    paymentLinkIds,
    excludeCustomerIds
  } = allowlist;

  if (obj?.livemode === false) {
    return { attributed: false, reason: 'test_mode' };
  }

  const customer = obj.customer ? String(obj.customer) : '';
  if (customer && excludeCustomerIds.has(customer)) {
    return { attributed: false, reason: 'excluded_owner_or_smoke' };
  }

  if (hasForeignAppSource(m, appSourceKey, appSourceValue)) {
    return { attributed: false, reason: 'other_application' };
  }

  if (m[appSourceKey] && stringEquals(m[appSourceKey], appSourceValue)) {
    return { attributed: true, reason: 'gtm_source_metadata' };
  }

  if (legacyCreditsKeysAllOf.every((k) => m[k] != null && String(m[k]).trim() !== '')) {
    return { attributed: true, reason: 'legacy_credits_metadata' };
  }

  const lineIds = sessionLinePriceIds(obj);
  for (const id of lineIds) {
    if (priceIds.has(id) || productIds.has(id)) {
      return { attributed: true, reason: 'allowlisted_price_or_product' };
    }
  }

  // Direct price/product on object (rare)
  if (obj.price && priceIds.has(String(obj.price))) {
    return { attributed: true, reason: 'allowlisted_price' };
  }
  if (m.priceId && priceIds.has(String(m.priceId))) {
    return { attributed: true, reason: 'allowlisted_price_metadata' };
  }
  if (m.productId && productIds.has(String(m.productId))) {
    return { attributed: true, reason: 'allowlisted_product_metadata' };
  }

  const paymentLink = obj.payment_link ? String(obj.payment_link) : m.payment_link;
  if (paymentLink && paymentLinkIds.has(paymentLink)) {
    return { attributed: true, reason: 'allowlisted_payment_link' };
  }

  return { attributed: false, reason: 'unknown_attribution' };
}

export function isGetTrainMateAttributed(obj, allowlist) {
  return classifyStripeObject(obj, allowlist).attributed;
}
