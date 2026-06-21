// Invoice → inventory matching (pure, no app/Supabase deps so it's unit-testable).

// Normalize a product name into comparable tokens: lowercase, strip punctuation,
// drop size/qty tokens (750ml, 1l, 12pk) and filler words.
export const STOPWORDS = ["the", "and", "of", "with"];

export function normalizeTokens(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .filter((w) => !/^\d+(ml|l|oz|cl|g|kg|pk|pack|ct)?$/.test(w))
    .filter((w) => !STOPWORDS.includes(w));
}

// Find the best inventory match for an invoice line item.
// Priority: exact SKU → token-overlap score. Returns { match, confidence }.
// Prefers precision (a wrong price update is worse than going to the queue).
export function matchInvoiceItem(invItem, items) {
  const sku = (invItem.sku || "").toLowerCase().trim();
  if (sku) {
    const bySku = items.find((i) => i.sku && i.sku.toLowerCase().trim() === sku);
    if (bySku) return { match: bySku, confidence: "high" };
  }
  const invTokens = normalizeTokens(invItem.rawName);
  if (invTokens.length === 0) return { match: null, confidence: null };
  let best = null, bestScore = 0;
  for (const it of items) {
    const itTokens = normalizeTokens(it.name);
    if (itTokens.length === 0) continue;
    const overlap = itTokens.filter((t) => invTokens.includes(t)).length;
    const score = overlap / itTokens.length; // share of the inventory name found on the invoice line
    if (score > bestScore) { bestScore = score; best = it; }
  }
  if (best && bestScore >= 0.6) return { match: best, confidence: bestScore >= 0.85 ? "high" : "low" };
  return { match: null, confidence: null };
}
