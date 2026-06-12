import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GOLD = "#c9a96e";
const BG = "#080810";
const SURFACE = "#0f0f1a";
const SURFACE2 = "#141422";
const BORDER = "#1e1e2e";
const TEXT = "#e8e4dc";
const MUTED = "#9898aa";
const GREEN = "#4ade80";
const RED = "#f87171";
const AMBER = "#fbbf24";
const BLUE = "#60a5fa";

const TABS = ["Inventory","Invoices","Count","Invoice Log","Unmatched"];

const CATEGORIES = ["All","Spirits","Wine","Beer — Bottle/Can","Beer — Keg","Mixers & Garnishes","Bar Supplies"];

const SUBCATEGORIES = {
  "Spirits": ["Whiskey","Bourbon","Scotch","Irish Whiskey","Vodka","Gin","Rum","Tequila","Mezcal","Brandy","Cognac","Liqueur","Amaro","Other Spirit"],
  "Wine": ["Red","White","Rosé","Sparkling","Champagne","Prosecco","Dessert","Fortified"],
  "Beer — Bottle/Can": ["Domestic","Craft","Import","Seltzer/Hard","NA Beer"],
  "Beer — Keg": ["Half Barrel (15.5 gal)","Quarter Barrel (7.75 gal)","Sixth Barrel (5.16 gal)","Other"],
  "Mixers & Garnishes": ["Juice","Soda","Syrup","Bitter","Tonic","Garnish","Other Mixer"],
  "Bar Supplies": ["Glassware","Straws","Napkins","Other Supply"],
};

const fmt = v => v == null || isNaN(v) ? "—" : `$${Number(v).toFixed(2)}`;

const S = {
  app: { background: BG, minHeight: "100vh", color: TEXT, fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", maxWidth: 768, margin: "0 auto", paddingBottom: 80 },
  header: { background: SURFACE, borderBottom: `1px solid ${BORDER}`, padding: "16px 16px 0", position: "sticky", top: 0, zIndex: 50 },
  tabBar: { display: "flex", overflowX: "auto", scrollbarWidth: "none" },
  tab: a => ({ flex: "0 0 auto", padding: "10px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", border: "none", background: "none", cursor: "pointer", color: a ? GOLD : MUTED, borderBottom: a ? `2px solid ${GOLD}` : "2px solid transparent" }),
  content: { padding: 16 },
  card: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 12 },
  input: { background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "10px 12px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none" },
  btn: (c = GOLD) => ({ background: c, color: c === GOLD ? "#111" : "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }),
  outlineBtn: { background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 8, color: TEXT, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  cancelBtn: { background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, color: MUTED, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" },
  modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modalBox: { background: SURFACE, borderRadius: 16, padding: 20, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 11, color: MUTED, marginBottom: 6, marginTop: 14, letterSpacing: "0.06em", textTransform: "uppercase" },
  badge: c => ({ display: "inline-block", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: c + "22", color: c }),
  stat: { flex: 1, background: SURFACE2, borderRadius: 10, padding: "12px 14px", border: `1px solid ${BORDER}` },
  statLabel: { fontSize: 10, color: MUTED, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 },
  statVal: { fontSize: 22, fontWeight: 800, color: GOLD },
};

export default function App() {
  const [activeTab, setActiveTab] = useState("Inventory");
  const [items, setItems] = useState([]);
  const [invoiceLog, setInvoiceLog] = useState([]);
  const [unmatchedItems, setUnmatchedItems] = useState([]);
  const [countHistory, setCountHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [categorizeItem, setCategorizeItem] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [viewInvoiceItems, setViewInvoiceItems] = useState([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [countMode, setCountMode] = useState(false);
  const [draftCounts, setDraftCounts] = useState({});
  const [scanState, setScanState] = useState("idle");
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [scanPreview, setScanPreview] = useState(null);
  const [editTab, setEditTab] = useState("basic");
  const [openSupplier, setOpenSupplier] = useState(null);
  const [openMonth, setOpenMonth] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const [itemsRes, invoicesRes, unmatchedRes, countsRes] = await Promise.all([
        supabase.from("bar_items").select("*").order("category").order("name"),
        supabase.from("bar_invoices").select("*").order("scanned_at", { ascending: false }).limit(50),
        supabase.from("bar_unmatched_items").select("*").eq("resolved", false).order("created_at", { ascending: false }),
        supabase.from("bar_count_sessions").select("*").order("counted_at", { ascending: false }).limit(20),
      ]);
      const firstErr = itemsRes.error || invoicesRes.error || unmatchedRes.error || countsRes.error;
      if (firstErr) throw firstErr;
      setItems(itemsRes.data || []);
      setInvoiceLog(invoicesRes.data || []);
      setUnmatchedItems(unmatchedRes.data || []);
      setCountHistory(countsRes.data || []);
    } catch (e) { console.error("Failed to load bar data:", e.message || e); }
    setLoading(false);
  }

  const filteredItems = useMemo(() => items.filter(i => {
    const matchCat = catFilter === "All" || i.category === catFilter;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.supplier.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  }), [items, catFilter, search]);

  const totalValue = useMemo(() => items.reduce((s, i) => s + (i.unit_cost || 0), 0), [items]);

  // ── INVOICE SCANNER ──
  async function handleFile(file) {
    if (!file) return;
    setScanState("scanning");
    setScanError(null);
    setScanPreview(URL.createObjectURL(file));
    let base64, mediaType;
    try {
      if (file.type !== "application/pdf") {
        base64 = await new Promise((res, rej) => {
          const img = new Image(), url = URL.createObjectURL(file);
          img.onload = () => {
            let w = img.width, h = img.height;
            if (w > 1600) { h = Math.round(h * 1600 / w); w = 1600; }
            const c = document.createElement("canvas");
            c.width = w; c.height = h;
            c.getContext("2d").drawImage(img, 0, 0, w, h);
            URL.revokeObjectURL(url);
            res(c.toDataURL("image/jpeg", 0.85).split(",")[1]);
          };
          img.onerror = () => rej(new Error("Image load failed"));
          img.src = url;
        });
        mediaType = "image/jpeg";
      } else {
        base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        mediaType = "application/pdf";
      }
    } catch (e) { setScanError(`File read error: ${e.message}`); setScanState("error"); return; }

    try {
      const resp = await fetch("/api/scan-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
      });
      const data = await resp.json();
      if (data.error) { setScanError(data.error); setScanState("error"); return; }
      setScanResult(data);
      setScanState("review");
    } catch (e) { setScanError(`Request failed: ${e.message}`); setScanState("error"); }
  }

  async function processInvoice(invoiceData) {
    const { supplier, invoiceDate, invoiceNumber, items: invoiceItems, invoiceTotal } = invoiceData;
    const date = invoiceDate || new Date().toISOString().split("T")[0];
    const matched = [], unmatched = [];

    invoiceItems.forEach(item => {
      const sku = (item.sku || "").toLowerCase().trim();
      let match = sku ? items.find(i => i.sku && i.sku.toLowerCase().trim() === sku) : null;
      if (!match && !sku) {
        const words = (item.rawName || "").toLowerCase().split(/[\s,\/]+/).filter(w => w.length > 3);
        match = items.find(ing => {
          if (ing.sku) return false;
          const ingWords = ing.name.toLowerCase().split(/[\s,\/]+/).filter(w => w.length > 3);
          return ingWords.every(w => words.some(r => r.includes(w) || w.includes(r)));
        });
      }
      if (match) matched.push({ ...item, matchedId: match.id, matchedName: match.name });
      else unmatched.push({ rawName: item.rawName, sku: item.sku || "", packSize: item.packSize || "", supplier, unitCost: item.unitCost, unit: item.unit || "bottle", invoiceDate: date, qty: item.qty, category: item.category || "" });
    });

    try {
      const { data: inv, error: invErr } = await supabase.from("bar_invoices").insert({
        supplier, invoice_date: date, invoice_number: invoiceNumber || null,
        total: invoiceTotal || 0, item_count: invoiceItems.length,
        matched_count: matched.length, unmatched_count: unmatched.length
      }).select().single();
      if (invErr) throw invErr;

      if (matched.length > 0) {
        await Promise.all(matched.map(async m => {
          if (m.unitCost > 0) {
            const { error: e1 } = await supabase.from("bar_items").update({ unit_cost: m.unitCost, supplier, updated_at: new Date().toISOString() }).eq("id", m.matchedId);
            if (e1) throw e1;
            const { error: e2 } = await supabase.from("bar_price_history").insert({ bar_item_id: m.matchedId, price: m.unitCost, supplier, source: "invoice" });
            if (e2) throw e2;
            if (m.sku) {
              const existing = items.find(i => i.id === m.matchedId);
              if (existing && !existing.sku) {
                const { error: e3 } = await supabase.from("bar_items").update({ sku: m.sku }).eq("id", m.matchedId);
                if (e3) throw e3;
              }
            }
          }
        }));
      }

      if (unmatched.length > 0) {
        const { error: uErr } = await supabase.from("bar_unmatched_items").insert(unmatched.map(u => ({
          invoice_id: inv.id, raw_name: u.rawName, supplier: u.supplier || "",
          unit_cost: u.unitCost || 0, unit: u.unit || "bottle",
          invoice_date: u.invoiceDate || null, qty: u.qty || 1,
          category: u.category || "", sku: u.sku || "", pack_size: u.packSize || "",
        })));
        if (uErr) throw uErr;
      }

      if (matched.length > 0 || unmatched.length > 0) {
        const { error: iErr } = await supabase.from("bar_invoice_items").insert([...matched, ...unmatched].map(item => ({
          invoice_id: inv.id, raw_name: item.rawName || "",
          sku: item.sku || "", qty: item.qty || 1, unit: item.unit || "bottle",
          unit_cost: item.unitCost || 0, total_cost: (item.unitCost || 0) * (item.qty || 1),
          matched_to: item.matchedName || "", matched_id: item.matchedId || null,
          category: item.category || "", pack_size: item.packSize || "",
        })));
        if (iErr) throw iErr;
      }

      await loadAll();
      setScanState("done");
    } catch (e) { setScanError(`Save failed: ${e.message}`); setScanState("error"); }
  }

  // ── SAVE COUNT ──
  async function saveCount() {
    const entered = items.filter(i => draftCounts[i.id + "_case"] !== undefined || draftCounts[i.id + "_bottle"] !== undefined);
    const total = entered.reduce((s, i) => {
      const cases = parseFloat(draftCounts[i.id + "_case"] || 0);
      const bottles = parseFloat(draftCounts[i.id + "_bottle"] || 0);
      const caseSize = i.case_size || 1;
      return s + ((cases * caseSize) + bottles) * (i.unit_cost || 0);
    }, 0);
    try {
      const { data: session, error: sErr } = await supabase.from("bar_count_sessions").insert({
        counted_at: new Date().toISOString().split("T")[0],
        total_value: total, item_count: entered.length,
      }).select().single();
      if (sErr) throw sErr;
      if (entered.length > 0) {
        const { error: ciErr } = await supabase.from("bar_count_items").insert(entered.map(i => ({
          session_id: session.id, bar_item_id: i.id,
          cases: parseFloat(draftCounts[i.id + "_case"] || 0),
          bottles: parseFloat(draftCounts[i.id + "_bottle"] || 0),
          unit_cost: i.unit_cost || 0,
        })));
        if (ciErr) throw ciErr;
      }
      await loadAll();
    } catch (e) { console.error("Save count failed:", e.message || e); alert("Could not save count: " + (e.message || e)); return; }
    setDraftCounts({});
    setCountMode(false);
  }

  // ── INVENTORY TAB ──
  const InventoryTab = () => (
    <div>
      <div style={{ marginBottom: 8, display: "flex", gap: 6 }}>
        <input style={{ ...S.input, flex: 1, fontSize: 12, padding: "8px 10px" }} placeholder="Search bar inventory..." value={search} onChange={e => setSearch(e.target.value)} />
        <button style={{ ...S.btn(), padding: "8px 14px", fontSize: 12 }} onClick={() => { setEditTab("basic"); setEditItem({ name: "", category: "Spirits", subcategory: "", unit: "bottle", unit_cost: "", supplier: "", sku: "", location: "", case_size: "", notes: "" }); }}>+ Add</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", scrollbarWidth: "none" }}>
        {CATEGORIES.map(c => <button key={c} onClick={() => setCatFilter(c)} style={{ flex: "0 0 auto", padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", background: catFilter === c ? GOLD : SURFACE2, color: catFilter === c ? "#111" : MUTED, whiteSpace: "nowrap" }}>{c}</button>)}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>{filteredItems.length} items</div>
      {filteredItems.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🍸</div>
          <div style={{ fontSize: 14, color: MUTED }}>No bar items yet. Add items manually or upload an invoice.</div>
        </div>
      )}
      {filteredItems.map(item => (
        <div key={item.id} style={{ ...S.card, padding: "12px 14px", marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ flex: 1 }} onClick={() => { setEditTab("basic"); setEditItem({ ...item }); }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                {item.subcategory || item.category}{item.supplier ? ` · ${item.supplier}` : ""}{item.sku ? ` · ${item.sku}` : ""}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: item.unit_cost > 0 ? GOLD : MUTED }}>
                {item.unit_cost > 0 ? fmt(item.unit_cost) : "+ Price"}
                <span style={{ fontSize: 11, fontWeight: 400, color: MUTED }}>/{item.unit}</span>
              </div>
              {item.case_size && <div style={{ fontSize: 10, color: MUTED }}>{item.case_size}/{item.unit} per case</div>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // ── INVOICES TAB ──
  const InvoicesTab = () => {
    function reset() { setScanState("idle"); setScanResult(null); setScanPreview(null); setScanError(null); }

    if (scanState === "idle") return (
      <div>
        <div style={{ ...S.card, textAlign: "center", padding: "36px 20px" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🧾</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Scan Bar Invoice</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 28 }}>Upload invoices from your liquor distributor, wine rep, or beer supplier.</div>
          <div style={{ display: "flex", gap: 10 }}>
            <label style={{ flex: 1, cursor: "pointer" }}>
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              <div style={{ background: GOLD, color: "#111", borderRadius: 10, padding: "16px 10px", fontWeight: 700, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 24 }}>📷</span>Take Photo
              </div>
            </label>
            <label style={{ flex: 1, cursor: "pointer" }}>
              <input type="file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
              <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 10px", fontWeight: 700, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 24 }}>📁</span>Upload File
              </div>
            </label>
          </div>
        </div>
      </div>
    );

    if (scanState === "scanning") return (
      <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 14, fontWeight: 700 }}>Scanning invoice...</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Claude is extracting line items</div>
      </div>
    );

    if (scanState === "error") return (
      <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 14, color: RED, marginBottom: 12 }}>{scanError}</div>
        <button style={S.btn()} onClick={reset}>Try Again</button>
      </div>
    );

    if (scanState === "review" && scanResult) {
      const previewMatches = (scanResult.items || []).map(item => {
        const sku = (item.sku || "").toLowerCase().trim();
        let match = sku ? items.find(i => i.sku && i.sku.toLowerCase().trim() === sku) : null;
        if (!match && !sku) {
          const words = (item.rawName || "").toLowerCase().split(/[\s,\/]+/).filter(w => w.length > 3);
          match = items.find(i => {
            if (i.sku) return false;
            const iw = i.name.toLowerCase().split(/[\s,\/]+/).filter(w => w.length > 3);
            return iw.every(w => words.some(r => r.includes(w) || w.includes(r)));
          });
        }
        return { ...item, match };
      });
      const matchedCount = previewMatches.filter(i => i.match).length;
      const unmatchedCount = previewMatches.filter(i => !i.match).length;

      return (
        <div>
          <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: GOLD, padding: "4px 0", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>← Back</button>
          <div style={S.card}>
            <div style={S.row}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{scanResult.supplier || "Unknown Supplier"}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{scanResult.invoiceDate}{scanResult.invoiceNumber ? ` · #${scanResult.invoiceNumber}` : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: GOLD }}>{fmt(scanResult.invoiceTotal)}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{scanResult.items?.length || 0} items</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <span style={S.badge(GREEN)}>{matchedCount} matched</span>
              {unmatchedCount > 0 && <span style={S.badge(AMBER)}>{unmatchedCount} unmatched</span>}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Review Line Items</div>
          {previewMatches.map((item, i) => (
            <div key={i} style={{ ...S.card, padding: "12px 14px", marginBottom: 8, borderLeft: `3px solid ${item.match ? GREEN : AMBER}` }}>
              <div style={S.row}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{item.rawName}</div>
                  {item.packSize && <div style={{ fontSize: 10, color: AMBER }}>{item.packSize}</div>}
                  {item.match
                    ? <div style={{ fontSize: 11, color: GREEN, marginTop: 2 }}>→ {item.match.name}</div>
                    : <div style={{ fontSize: 11, color: AMBER, marginTop: 2 }}>→ Goes to queue</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{fmt(item.unitCost)}</div>
                  <div style={{ fontSize: 11, color: MUTED }}>qty {item.qty} {item.unit}</div>
                </div>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ ...S.cancelBtn }} onClick={reset}>Cancel</button>
            <button style={{ ...S.btn(GREEN), flex: 1 }} onClick={() => processInvoice(scanResult)}>Apply to Bar Inventory ✓</button>
          </div>
        </div>
      );
    }

    if (scanState === "done") return (
      <div style={{ ...S.card, textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Invoice Saved</div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Prices updated and unmatched items added to queue.</div>
        <button style={S.btn()} onClick={reset}>Scan Another</button>
      </div>
    );
  };

  // ── COUNT TAB ──
  const CountTab = () => {
    const cats = [...new Set(items.map(i => i.category))].filter(Boolean);
    const [activeCat, setActiveCat] = useState(cats[0] || "");
    const catItems = items.filter(i => i.category === activeCat);
    const entered = Object.keys(draftCounts).length;

    if (!countMode) return (
      <div>
        <div style={S.card}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Bar Inventory Count</div>
          <div style={{ fontSize: 13, color: MUTED, marginBottom: 16 }}>{items.length} items across {cats.length} categories</div>
          <button style={{ ...S.btn(), width: "100%", padding: 14 }} onClick={() => { setCountMode(true); setDraftCounts({}); }}>Start Count</button>
        </div>
        {countHistory.length > 0 && (
          <div style={S.card}>
            <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Count History</div>
            {countHistory.map((c, i) => (
              <div key={i} style={{ ...S.row, padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(c.counted_at).toLocaleDateString()}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>${Number(c.total_value).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );

    return (
      <div>
        <div style={{ ...S.card, padding: "12px 14px", marginBottom: 8 }}>
          <div style={S.row}>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>Counting: {activeCat}</div>
            <div style={{ fontSize: 11, color: MUTED }}>{entered} entered</div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto", scrollbarWidth: "none" }}>
            {cats.map(c => <button key={c} onClick={() => setActiveCat(c)} style={{ flex: "0 0 auto", padding: "5px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, border: "none", cursor: "pointer", background: c === activeCat ? GOLD : SURFACE2, color: c === activeCat ? "#111" : MUTED }}>{c.split(" ")[0]}</button>)}
          </div>
        </div>

        {catItems.map(item => {
          const isKeg = item.category === "Beer — Keg";
          const caseVal = draftCounts[item.id + "_case"] ?? "";
          const bottleVal = draftCounts[item.id + "_bottle"] ?? "";
          const isEntered = caseVal !== "" || bottleVal !== "";

          return (
            <div key={item.id} style={{ ...S.card, padding: "12px 14px", marginBottom: 8, borderColor: isEntered ? GOLD : BORDER }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{item.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!isKeg && (
                  <>
                    <input type="number" step="1" min="0" placeholder="0"
                      value={caseVal}
                      onChange={e => setDraftCounts(d => ({ ...d, [item.id + "_case"]: e.target.value }))}
                      style={{ ...S.input, width: 70, textAlign: "center", padding: "8px 6px", fontSize: 14, fontWeight: 700 }}
                    />
                    <span style={{ fontSize: 11, color: MUTED }}>case</span>
                    <span style={{ fontSize: 12, color: MUTED }}>+</span>
                  </>
                )}
                <input type="number" step="0.1" min="0" placeholder="0"
                  value={bottleVal}
                  onChange={e => setDraftCounts(d => ({ ...d, [item.id + "_bottle"]: e.target.value }))}
                  style={{ ...S.input, width: 70, textAlign: "center", padding: "8px 6px", fontSize: 14, fontWeight: 700 }}
                />
                <span style={{ fontSize: 11, color: MUTED }}>{isKeg ? "keg" : "bottle"}</span>
                {item.unit_cost > 0 && isEntered && (
                  <span style={{ fontSize: 11, color: GOLD, marginLeft: 4 }}>
                    = {fmt(((parseFloat(caseVal || 0) * (item.case_size || 1)) + parseFloat(bottleVal || 0)) * item.unit_cost)}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button style={{ ...S.cancelBtn }} onClick={() => { setCountMode(false); setDraftCounts({}); }}>Cancel</button>
          <button style={{ ...S.btn(GREEN), flex: 1 }} onClick={saveCount}>Save Count ✓</button>
        </div>
      </div>
    );
  };

  // ── INVOICE LOG TAB ──
  const InvoiceLogTab = () => {
    const [logSearch, setLogSearch] = useState("");
    const filtered = invoiceLog.filter(inv => !logSearch || (inv.supplier || "").toLowerCase().includes(logSearch.toLowerCase()));
    const grouped = {};
    filtered.forEach(inv => {
      const supplier = inv.supplier || "Unknown";
      const date = inv.scanned_at ? new Date(inv.scanned_at) : null;
      const year = date ? date.getFullYear() : "Unknown";
      const month = date ? date.toLocaleString("default", { month: "long" }) : "Unknown";
      if (!grouped[supplier]) grouped[supplier] = {};
      if (!grouped[supplier][year]) grouped[supplier][year] = {};
      if (!grouped[supplier][year][month]) grouped[supplier][year][month] = { invoices: [], total: 0 };
      grouped[supplier][year][month].invoices.push(inv);
      grouped[supplier][year][month].total += parseFloat(inv.total) || 0;
    });
    const suppliers = Object.keys(grouped).sort();

    return (
      <div>
        <input style={{ ...S.input, marginBottom: 12 }} placeholder="Search supplier..." value={logSearch} onChange={e => setLogSearch(e.target.value)} />
        {filtered.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40 }}><div style={{ fontSize: 32, marginBottom: 8 }}>🧾</div><div style={{ fontSize: 14, color: MUTED }}>No invoices yet.</div></div>}
        {suppliers.map(supplier => {
          const isOpen = openSupplier === supplier;
          const total = filtered.filter(i => (i.supplier || "Unknown") === supplier).reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
          const count = filtered.filter(i => (i.supplier || "Unknown") === supplier).length;
          return (
            <div key={supplier} style={{ marginBottom: 8 }}>
              <div onClick={() => { setOpenSupplier(isOpen ? null : supplier); setOpenMonth(null); }} style={{ ...S.card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `3px solid ${GOLD}` }}>
                <div><div style={{ fontSize: 14, fontWeight: 700 }}>{supplier}</div><div style={{ fontSize: 11, color: MUTED }}>{count} invoice{count !== 1 ? "s" : ""}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 15, fontWeight: 800, color: GOLD }}>{fmt(total)}</div><div style={{ fontSize: 14, color: MUTED }}>{isOpen ? "▾" : "▸"}</div></div>
              </div>
              {isOpen && Object.keys(grouped[supplier]).sort((a, b) => b - a).map(year => (
                <div key={year} style={{ marginLeft: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: "uppercase", padding: "8px 4px" }}>{year}</div>
                  {Object.keys(grouped[supplier][year]).map(month => {
                    const mk = `${supplier}-${year}-${month}`;
                    const isMonthOpen = openMonth === mk;
                    const md = grouped[supplier][year][month];
                    return (
                      <div key={month}>
                        <div onClick={() => setOpenMonth(isMonthOpen ? null : mk)} style={{ ...S.card, cursor: "pointer", marginLeft: 8, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `2px solid ${BORDER}` }}>
                          <div><div style={{ fontSize: 13, fontWeight: 600 }}>{month}</div><div style={{ fontSize: 11, color: MUTED }}>{md.invoices.length} invoice{md.invoices.length !== 1 ? "s" : ""}</div></div>
                          <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{fmt(md.total)}</div><div style={{ fontSize: 14, color: MUTED }}>{isMonthOpen ? "▾" : "▸"}</div></div>
                        </div>
                        {isMonthOpen && md.invoices.map((inv, i) => (
                          <div key={i} onClick={async () => { setViewInvoice(inv); const { data } = await supabase.from("bar_invoice_items").select("*").eq("invoice_id", inv.id); setViewInvoiceItems(data || []); }} style={{ ...S.card, marginLeft: 20, marginBottom: 4, cursor: "pointer", borderLeft: `2px solid ${SURFACE2}` }}>
                            <div style={S.row}>
                              <div>{inv.invoice_number && <div style={{ fontSize: 12, fontWeight: 700 }}>#{inv.invoice_number}</div>}<div style={{ fontSize: 11, color: MUTED }}>{inv.invoice_date || new Date(inv.scanned_at).toLocaleDateString()}</div></div>
                              <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{fmt(inv.total)}</div><div style={{ fontSize: 11, color: MUTED }}>{inv.item_count} items · <span style={{ color: GREEN }}>{inv.matched_count} matched</span></div></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  // ── UNMATCHED TAB ──
  const UnmatchedTab = () => (
    <div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 12 }}>{unmatchedItems.length} items need categorization</div>
      {unmatchedItems.length === 0 && <div style={{ ...S.card, textAlign: "center", padding: 40 }}><div style={{ fontSize: 32, marginBottom: 8 }}>✅</div><div style={{ fontSize: 14, color: MUTED }}>All items categorized!</div></div>}
      {unmatchedItems.map(item => (
        <div key={item.id} style={S.card}>
          <div style={S.row}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.raw_name}</div>
              <div style={{ fontSize: 11, color: MUTED }}>{item.supplier} · {fmt(item.unit_cost)}/{item.unit}</div>
              {item.pack_size && <div style={{ fontSize: 11, color: AMBER }}>{item.pack_size}</div>}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: GOLD }}>{fmt(item.unit_cost)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={{ ...S.outlineBtn, flex: 1, fontSize: 12, color: GOLD, borderColor: GOLD }} onClick={() => setCategorizeItem({ ...item, rawName: item.raw_name, packSize: item.pack_size })}>Categorize</button>
            <button style={{ ...S.outlineBtn, fontSize: 12, color: MUTED }} onClick={async () => { const { error } = await supabase.from("bar_unmatched_items").update({ resolved: true }).eq("id", item.id); if (error) { alert("Could not dismiss: " + error.message); return; } setUnmatchedItems(u => u.filter(x => x.id !== item.id)); }}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  );

  // ── EDIT MODAL ──
  const EditModal = () => {
    const [form, setForm] = useState(editItem || {});
    const [saving, setSaving] = useState(false);
    const isNew = !form.id;

    async function save() {
      setSaving(true);
      try {
        const row = { name: form.name, category: form.category, subcategory: form.subcategory || "", unit: form.unit || "bottle", unit_cost: parseFloat(form.unit_cost) || 0, supplier: form.supplier || "", sku: form.sku || "", location: form.location || "", case_size: form.case_size ? parseFloat(form.case_size) : null, notes: form.notes || "", updated_at: new Date().toISOString() };
        if (isNew) {
          const { data, error } = await supabase.from("bar_items").insert(row).select().single();
          if (error) throw error;
          setItems(prev => [...prev, data]);
        } else {
          const { data, error } = await supabase.from("bar_items").update(row).eq("id", form.id).select().single();
          if (error) throw error;
          setItems(prev => prev.map(i => i.id === data.id ? data : i));
        }
      } catch (e) { console.error("Save item failed:", e.message || e); alert("Could not save item: " + (e.message || e)); setSaving(false); return; }
      setSaving(false);
      setEditItem(null);
    }

    async function del() {
      const { error } = await supabase.from("bar_items").delete().eq("id", form.id);
      if (error) { console.error("Delete failed:", error.message); alert("Could not delete item: " + error.message); return; }
      setItems(prev => prev.filter(i => i.id !== form.id));
      setEditItem(null);
    }

    const subs = SUBCATEGORIES[form.category] || [];

    return (
      <div style={S.modal} onClick={() => setEditItem(null)}>
        <div style={S.modalBox} onClick={e => e.stopPropagation()}>
          <div style={{ ...S.row, marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{isNew ? "New Bar Item" : form.name}</div>
            {!isNew && <button style={{ ...S.outlineBtn, color: RED, borderColor: RED }} onClick={del}>Delete</button>}
          </div>
          <div style={{ display: "flex", background: SURFACE2, borderRadius: 10, padding: 3, marginBottom: 14 }}>
            {[["basic", "Basic"], ["units", "Units"], ["storage", "Storage"]].map(([t, l]) => (
              <button key={t} onClick={() => setEditTab(t)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: editTab === t ? GOLD : "transparent", color: editTab === t ? "#111" : MUTED }}>{l}</button>
            ))}
          </div>

          {editTab === "basic" && <>
            <div style={S.label}>Name</div>
            <input style={S.input} value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Bulleit Bourbon" />
            <div style={S.label}>Category</div>
            <select style={S.input} value={form.category || ""} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: "" }))}>
              {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {subs.length > 0 && <>
              <div style={S.label}>Subcategory</div>
              <select style={S.input} value={form.subcategory || ""} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}>
                <option value="">Select...</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </>}
            <div style={S.label}>Supplier</div>
            <input style={S.input} value={form.supplier || ""} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
            <div style={S.label}>Supplier SKU</div>
            <input style={S.input} value={form.sku || ""} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            <div style={S.label}>Unit Cost ($)</div>
            <input style={S.input} type="number" value={form.unit_cost || ""} onChange={e => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
          </>}

          {editTab === "units" && <>
            <div style={S.label}>Unit</div>
            <select style={S.input} value={form.unit || "bottle"} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
              {["bottle","can","keg","case","each","liter","750ml","1L","1.75L"].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div style={S.label}>Case Size (units per case)</div>
            <input style={S.input} type="number" placeholder="e.g. 12" value={form.case_size || ""} onChange={e => setForm(f => ({ ...f, case_size: e.target.value }))} />
          </>}

          {editTab === "storage" && <>
            <div style={S.label}>Storage Location</div>
            <input style={S.input} value={form.location || ""} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Back bar, Walk-in, Cage" />
            <div style={S.label}>Notes</div>
            <input style={S.input} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any additional notes" />
          </>}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button style={S.cancelBtn} onClick={() => setEditItem(null)}>Cancel</button>
            <button style={{ ...S.btn(), flex: 1, opacity: saving ? 0.6 : 1 }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── CATEGORIZE MODAL ──
  const CategorizeModal = () => {
    const item = categorizeItem;
    const [name, setName] = useState((item?.rawName || "").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
    const [category, setCategory] = useState("Spirits");
    const [subcategory, setSubcategory] = useState("");
    const [unit, setUnit] = useState(item?.unit || "bottle");
    const [caseSize, setCaseSize] = useState("");
    const [sku, setSku] = useState(item?.sku || "");
    const [location, setLocation] = useState("");

    async function addAsNew() {
      try {
        const { data, error } = await supabase.from("bar_items").insert({
          name, category, subcategory, unit, unit_cost: item.unit_cost, supplier: item.supplier || "", sku: sku || "", case_size: caseSize ? parseFloat(caseSize) : null, location,
        }).select().single();
        if (error) throw error;
        const { error: phErr } = await supabase.from("bar_price_history").insert({ bar_item_id: data.id, price: item.unit_cost, supplier: item.supplier, source: "invoice" });
        if (phErr) throw phErr;
        const { error: umErr } = await supabase.from("bar_unmatched_items").update({ resolved: true }).eq("id", item.id);
        if (umErr) throw umErr;
        setItems(prev => [...prev, data]);
        setUnmatchedItems(u => u.filter(x => x.id !== item.id));
      } catch (e) { console.error("Add to inventory failed:", e.message || e); alert("Could not add item: " + (e.message || e)); return; }
      setCategorizeItem(null);
    }

    const subs = SUBCATEGORIES[category] || [];

    return (
      <div style={S.modal} onClick={() => setCategorizeItem(null)}>
        <div style={S.modalBox} onClick={e => e.stopPropagation()}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: AMBER, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>Invoice Item</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{item?.rawName}</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{item?.supplier} · {fmt(item?.unit_cost)}/{item?.unit}</div>
            {item?.packSize && <div style={{ fontSize: 12, color: GOLD, fontWeight: 700, marginTop: 4 }}>Pack: {item.packSize}</div>}
          </div>
          <div style={S.label}>Item Name</div>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} />
          <div style={S.label}>Category</div>
          <select style={S.input} value={category} onChange={e => { setCategory(e.target.value); setSubcategory(""); }}>
            {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {subs.length > 0 && <>
            <div style={S.label}>Subcategory</div>
            <select style={S.input} value={subcategory} onChange={e => setSubcategory(e.target.value)}>
              <option value="">Select...</option>
              {subs.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </>}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Unit</div>
              <select style={S.input} value={unit} onChange={e => setUnit(e.target.value)}>
                {["bottle","can","keg","case","each","liter","750ml","1L","1.75L"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.label}>Case Size</div>
              <input style={S.input} type="number" placeholder="e.g. 12" value={caseSize} onChange={e => setCaseSize(e.target.value)} />
            </div>
          </div>
          <div style={S.label}>Supplier SKU</div>
          <input style={S.input} value={sku} onChange={e => setSku(e.target.value)} />
          <div style={S.label}>Storage Location</div>
          <input style={S.input} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Back bar, Walk-in, Cage" />
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button style={S.cancelBtn} onClick={() => setCategorizeItem(null)}>Cancel</button>
            <button style={{ ...S.btn(GREEN), flex: 1 }} onClick={addAsNew}>Add to Bar Inventory</button>
          </div>
        </div>
      </div>
    );
  };

  // ── INVOICE VIEWER ──
  const InvoiceViewerModal = () => {
    const inv = viewInvoice;
    return (
      <div style={S.modal} onClick={() => setViewInvoice(null)}>
        <div style={S.modalBox} onClick={e => e.stopPropagation()}>
          <div style={{ ...S.row, marginBottom: 16 }}>
            <div><div style={{ fontSize: 18, fontWeight: 800 }}>{inv.supplier}</div>{inv.invoice_number && <div style={{ fontSize: 12, color: MUTED }}>#{inv.invoice_number}</div>}</div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>{fmt(inv.total)}</div><div style={{ fontSize: 11, color: MUTED }}>{inv.invoice_date}</div></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 4px", borderBottom: `1px solid ${BORDER}`, marginBottom: 4 }}>
            {["ITEM", "PACK", "QTY", "UNIT $", "TOTAL"].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 700, color: MUTED }}>{h}</div>)}
          </div>
          {viewInvoiceItems.map((item, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{ flex: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{item.raw_name}</div>
                {item.matched_to ? <div style={{ fontSize: 10, color: GREEN }}>→ {item.matched_to}</div> : <div style={{ fontSize: 10, color: AMBER }}>→ Unmatched</div>}
              </div>
              <div style={{ fontSize: 11, color: TEXT, width: 55 }}>{item.pack_size || "—"}</div>
              <div style={{ fontSize: 12, color: MUTED, width: 30 }}>{item.qty}</div>
              <div style={{ fontSize: 12, width: 55 }}>{fmt(item.unit_cost)}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, width: 60 }}>{fmt(item.total_cost)}</div>
            </div>
          ))}
          <button style={{ ...S.cancelBtn, marginTop: 16 }} onClick={() => setViewInvoice(null)}>Close</button>
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: BG, color: MUTED, fontSize: 14 }}>Loading Bar Inventory…</div>;

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: GOLD, textTransform: "uppercase" }}>Project R</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>Bar Inventory</div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: MUTED }}>Catalog Value</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>{fmt(totalValue)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 10, color: MUTED }}>Items</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{items.length}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <button onClick={() => { const el = document.getElementById("barTabScroll"); el.scrollLeft -= 120; }} style={{ background: "none", border: "none", color: MUTED, padding: "8px 4px", cursor: "pointer", fontSize: 18 }}>‹</button>
          <div id="barTabScroll" style={{ ...S.tabBar, flex: 1, scrollBehavior: "smooth" }}>
            {TABS.map(t => <button key={t} style={S.tab(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</button>)}
          </div>
          <button onClick={() => { const el = document.getElementById("barTabScroll"); el.scrollLeft += 120; }} style={{ background: "none", border: "none", color: MUTED, padding: "8px 4px", cursor: "pointer", fontSize: 18 }}>›</button>
        </div>
      </div>

      <div style={S.content}>
        {/* Hookless sections are called as functions (not <Comp/>) so they don't
            remount on every App render — fixes e.g. the search box losing focus. */}
        {activeTab === "Inventory" && InventoryTab()}
        {activeTab === "Invoices" && InvoicesTab()}
        {activeTab === "Count" && <CountTab />}
        {activeTab === "Invoice Log" && <InvoiceLogTab />}
        {activeTab === "Unmatched" && UnmatchedTab()}
      </div>

      {editItem && <EditModal />}
      {categorizeItem && <CategorizeModal />}
      {viewInvoice && InvoiceViewerModal()}
    </div>
  );
}
