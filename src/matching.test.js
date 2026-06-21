import { describe, it, expect } from "vitest";
import { normalizeTokens, matchInvoiceItem } from "./matching";

const items = [
  { id: 1, name: "Tito's Handmade Vodka", sku: "TITO750" },
  { id: 2, name: "Grey Goose Vodka", sku: "" },
  { id: 3, name: "Bacardi Superior Rum", sku: "" },
];

describe("normalizeTokens", () => {
  it("lowercases, strips punctuation, drops size and short tokens", () => {
    expect(normalizeTokens("Tito's Handmade Vodka 750ml")).toEqual(["tito", "handmade", "vodka"]);
  });
  it("drops filler words and quantity packs", () => {
    expect(normalizeTokens("The Case of Soda 12pk")).toEqual(["case", "soda"]);
  });
  it("keeps short real words like gin and rum", () => {
    expect(normalizeTokens("Bombay Gin")).toEqual(["bombay", "gin"]);
  });
  it("returns empty array for empty input", () => {
    expect(normalizeTokens("")).toEqual([]);
    expect(normalizeTokens(null)).toEqual([]);
  });
});

describe("matchInvoiceItem", () => {
  it("matches by SKU first, case-insensitively, with high confidence", () => {
    const r = matchInvoiceItem({ rawName: "unrelated text", sku: "tito750" }, items);
    expect(r.match?.id).toBe(1);
    expect(r.confidence).toBe("high");
  });

  it("matches by name with high confidence when all tokens overlap", () => {
    const r = matchInvoiceItem({ rawName: "Tito's Handmade Vodka 1.75L", sku: "" }, items);
    expect(r.match?.id).toBe(1);
    expect(r.confidence).toBe("high");
  });

  it("flags a partial name match as low confidence", () => {
    // 'bacardi rum' overlaps 2 of 3 inventory tokens (bacardi, superior, rum) = 0.67
    const r = matchInvoiceItem({ rawName: "Bacardi Rum 1L", sku: "" }, items);
    expect(r.match?.id).toBe(3);
    expect(r.confidence).toBe("low");
  });

  it("does not match unrelated items (below threshold)", () => {
    const r = matchInvoiceItem({ rawName: "Coca-Cola Fountain Syrup", sku: "" }, items);
    expect(r.match).toBeNull();
  });

  it("does not confuse two different vodkas", () => {
    const r = matchInvoiceItem({ rawName: "Grey Goose Vodka", sku: "" }, items);
    expect(r.match?.id).toBe(2);
  });

  it("returns null for an unparseable name", () => {
    const r = matchInvoiceItem({ rawName: "", sku: "" }, items);
    expect(r.match).toBeNull();
  });
});
