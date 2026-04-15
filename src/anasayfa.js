import { useMemo, useState, useCallback, useRef, useEffect } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(value, short = false) {
    const n = Number(value || 0);
    if (short) {
        if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".", ",") + "M ₺";
        if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + "K ₺";
        return n.toLocaleString("tr-TR") + " ₺";
    }
    return n.toLocaleString("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function parseNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let str = String(value).trim();
    if (str.includes(",") && str.includes(".")) str = str.replace(/\./g, "").replace(",", ".");
    else if (str.includes(",")) str = str.replace(",", ".");
    const parsed = Number(str);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function norm(value) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function monthLabel(start, end) {
    if (!start || !end) return "-";
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "-";

    const sameMonth = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth();
    if (sameMonth) {
        return s.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });
    }

    return `${s.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
    })} - ${e.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    })}`;
}

function normalizeRows(data) {
    return data.map((item, index) => ({
        id: item.id || item.TMSDespatchesId || `row-${index}`,
        Tipi: item.Tipi || item.Type || "-",
        TMSDespatchesId: item.TMSDespatchesId || `despatch-${index}`,
        TMSDespatchesDocumentNo: item.TMSDespatchesDocumentNo || item.DocumentNo || "-",
        TMSDespatchesDespatchDate: item.TMSDespatchesDespatchDate || null,
        SupplierName: item.SupplierName || "-",
        CurrentAccountsName: item.CurrentAccountsName || "-",
        ServiceExpense: item.ServiceExpense || "-",
        ServiceExpenseName: item.ServiceExpenseName || "-",
        PlateNumber: item.PlateNumber || "-",
        SubServiceName: item.SubServiceName || "-",
        ProjectName: item.ProjectName || "PROJESİZ",
        GivenVehicleTypeName: item.GivenVehicleTypeName || "-",
        VehicleWorkingTypeId: item.VehicleWorkingTypeId || "-",
        VehicleMasterGroupName: item.VehicleMasterGroupName || "-",
        SpecialGroupName: item.SpecialGroupName || "-",
        PurchaseInvoiceIncome: parseNumber(item.PurchaseInvoiceIncome),
        SalesInvoceIncome: parseNumber(item.SalesInvoceIncome),
        CreatedByName: item.CreatedByName || "-",
        CreatedDate: item.CreatedDate || null,
    }));
}

function aggregateByProject(rows) {
    const map = new Map();
    rows.forEach((r) => {
        const k = r.ProjectName || "PROJESİZ";
        if (!map.has(k)) {
            map.set(k, {
                key: k,
                projectName: k,
                purchaseTotal: 0,
                salesTotal: 0,
                profit: 0,
                details: [],
            });
        }
        const item = map.get(k);
        item.purchaseTotal += r.PurchaseInvoiceIncome;
        item.salesTotal += r.SalesInvoceIncome;
        item.profit = item.salesTotal - item.purchaseTotal;
        item.details.push(r);
    });

    return [...map.values()]
        .map((item) => ({
            ...item,
            plateCount: new Set(item.details.map((x) => x.PlateNumber || "-")).size,
        }))
        .sort((a, b) => b.profit - a.profit);
}

function aggregatePlateSummary(rows) {
    const map = new Map();
    rows.forEach((r) => {
        const k = r.PlateNumber || "-";
        if (!map.has(k)) {
            map.set(k, { plate: k, p: 0, s: 0, projects: new Set(), services: new Set(), rows: 0 });
        }
        const item = map.get(k);
        item.p += r.PurchaseInvoiceIncome;
        item.s += r.SalesInvoceIncome;
        item.rows += 1;
        if (r.ProjectName) item.projects.add(r.ProjectName);
        if (r.ServiceExpenseName && r.ServiceExpenseName !== "-") item.services.add(r.ServiceExpenseName);
    });
    return [...map.values()].map((x) => ({
        ...x,
        profit: x.s - x.p,
    }));
}

function aggregateServiceSummary(rows) {
    const map = new Map();
    rows.forEach((r) => {
        const k = r.ServiceExpenseName || "-";
        if (!map.has(k)) {
            map.set(k, { name: k, p: 0, s: 0, count: 0 });
        }
        const item = map.get(k);
        item.p += r.PurchaseInvoiceIncome;
        item.s += r.SalesInvoceIncome;
        item.count += 1;
    });
    return [...map.values()].map((x) => ({
        ...x,
        profit: x.s - x.p,
    }));
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body[data-theme="light"] {
  --bg: #eef2f8;
  --surface: #ffffff;
  --surface2: #f7f9fc;
  --surface3: #edf2fa;
  --border: #dbe4f0;
  --border2: #c7d3e4;
  --text: #122033;
  --text2: #42506a;
  --text3: #73809a;
  --accent: #2563eb;
  --accent-bg: #eff6ff;
  --accent-bg-2: #edf4ff;
  --accent-border: #bfd6ff;
  --green: #15803d;
  --green-bg: #f0fdf4;
  --green-border: #86efac;
  --red: #b91c1c;
  --red-bg: #fef2f2;
  --red-border: #fca5a5;
  --amber: #b45309;
  --amber-bg: #fffbeb;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 4px 18px rgba(15,23,42,0.07);
  --shadow-md: 0 14px 40px rgba(15,23,42,0.16);
  --radius: 18px;
  --radius-sm: 12px;
  --font: 'Nunito', sans-serif;
}

body:not([data-theme="light"]) {
  --bg: #0a0d14;
  --surface: #10151f;
  --surface2: #161c28;
  --surface3: #1c2433;
  --border: rgba(255,255,255,0.08);
  --border2: rgba(255,255,255,0.12);
  --text: #ffffff;
  --text2: #d1d5db;
  --text3: #9ca3af;
  --accent: #6d4aff;
  --accent-bg: rgba(109, 74, 255, 0.14);
  --accent-bg-2: rgba(109, 74, 255, 0.10);
  --accent-border: rgba(139, 92, 246, 0.32);
  --green: #22c55e;
  --green-bg: rgba(34,197,94,0.14);
  --green-border: rgba(34,197,94,0.28);
  --red: #f87171;
  --red-bg: rgba(248,113,113,0.14);
  --red-border: rgba(248,113,113,0.28);
  --amber: #f59e0b;
  --amber-bg: rgba(245,158,11,0.14);
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.35);
  --shadow: 0 8px 24px rgba(0,0,0,0.35);
  --shadow-md: 0 18px 48px rgba(0,0,0,0.46);
  --radius: 18px;
  --radius-sm: 12px;
  --font: 'Nunito', sans-serif;
}

html, body {
  font-family: var(--font);
  font-size: 17px;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

body { overflow: hidden; }

.app {
  min-height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.topbar {
  background: linear-gradient(180deg, var(--surface) 0%, var(--surface2) 100%);
  border-bottom: 1px solid var(--border);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: var(--shadow-sm);
}

.brand {
  font-size: 28px;
  font-weight: 900;
  color: var(--text);
  letter-spacing: -0.6px;
}

.brand em { color: var(--accent); font-style: normal; }

.spacer { flex: 1; }

.date-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.dlabel {
  font-size: 14px;
  font-weight: 800;
  color: var(--text3);
}

.dsep {
  font-size: 14px;
  color: var(--text3);
}

.dinput {
  padding: 10px 12px;
  border: 1px solid var(--border2);
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-family: var(--font);
  font-weight: 700;
  color: var(--text);
  background: var(--surface);
  outline: none;
  cursor: pointer;
}

.dinput:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(37,99,235,.12);
}

.btn-fetch {
  padding: 11px 20px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 900;
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s;
  white-space: nowrap;
}

.btn-fetch:hover { filter: brightness(1.05); }
.btn-fetch:disabled { opacity: .45; cursor: not-allowed; }

.body {
  display: block;
  flex: 1;
  overflow: hidden;
  height: calc(100vh - 82px);
}

.content {
  width: 100%;
  min-height: 100%;
  overflow-y: auto;
}

.stats-bar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.stat-cell {
  padding: 18px 22px;
  border-right: 1px solid var(--border);
}

.stat-cell:last-child { border-right: none; }

.stat-lbl {
  font-size: 12px;
  font-weight: 800;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 6px;
}

.stat-val {
  font-size: 30px;
  font-weight: 900;
  color: var(--text);
  letter-spacing: -0.6px;
}

.stat-val.g { color: var(--green); }
.stat-val.r { color: var(--red); }

.tabs {
  display: flex;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0 18px;
  overflow-x: auto;
}

.tab {
  padding: 15px 18px;
  font-size: 16px;
  font-weight: 800;
  color: var(--text2);
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all .12s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tab:hover { color: var(--text); }
.tab.active { color: var(--accent); border-bottom-color: var(--accent); }

.page {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  background: transparent;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}

.card-head {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--surface2);
}

.card-title {
  font-size: 18px;
  font-weight: 900;
  color: var(--text);
}

.card-sub {
  font-size: 14px;
  color: var(--text3);
  font-weight: 600;
  margin-top: 2px;
}

.card-body { padding: 18px; }

.ov-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
}

.pill-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.pill {
  flex: 1 1 160px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 16px 18px;
  box-shadow: var(--shadow-sm);
}

.pill-lbl {
  font-size: 12px;
  font-weight: 800;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 6px;
}

.pill-val {
  font-size: 30px;
  font-weight: 900;
  letter-spacing: -0.6px;
  color: var(--text);
}

.bar-item { margin-bottom: 12px; }
.bar-item:last-child { margin-bottom: 0; }

.bar-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 6px;
  gap: 8px;
}

.bar-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.bar-v {
  font-size: 14px;
  font-weight: 900;
  flex-shrink: 0;
}

.bar-track {
  height: 7px;
  background: var(--surface3);
  border-radius: 99px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 99px;
  transition: width .5s ease;
}

.tbl-wrap { overflow-x: auto; }

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

thead th {
  padding: 12px 14px;
  text-align: left;
  font-size: 12px;
  font-weight: 900;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .5px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}

th.r, td.r { text-align: right; }
th.c, td.c { text-align: center; }

tbody td {
  padding: 14px 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  vertical-align: middle;
}

tbody tr:last-child td { border-bottom: none; }
tr.clk { cursor: pointer; }
tr.clk:hover td { background: var(--surface2); }
tr.xpnd td { background: var(--accent-bg); }

tfoot td {
  padding: 14px;
  font-weight: 900;
  background: var(--surface2);
  border-top: 2px solid var(--border);
  font-size: 15px;
  color: var(--text);
}

.b {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
  border: 1px solid;
  line-height: 1.6;
}

.b-g { color: var(--green); border-color: var(--green-border); background: var(--green-bg); }
.b-r { color: var(--red); border-color: var(--red-border); background: var(--red-bg); }
.b-bl { color: var(--accent); border-color: var(--accent-border); background: var(--accent-bg); }
.b-gr { color: var(--text2); border-color: var(--border2); background: var(--surface2); }
.b-am { color: var(--amber); border-color: #fcd34d; background: var(--amber-bg); }

.f-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.f-sel, .f-inp, .sb-search {
  padding: 10px 12px;
  border: 1px solid var(--border2);
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-family: var(--font);
  font-weight: 700;
  color: var(--text);
  background: var(--surface);
  outline: none;
}

.f-sel:focus, .f-inp:focus, .sb-search:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(37,99,235,.10);
}

.f-tag {
  font-size: 13px;
  color: var(--text3);
  font-weight: 800;
}

.sb-search-wrap { position: relative; }
.sb-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text3);
  font-size: 14px;
  pointer-events: none;
}
.sb-search { padding-left: 32px; }

.xp-td {
  padding: 0 !important;
  background: var(--accent-bg-2) !important;
}

.xp-inner {
  padding: 18px;
  border-top: 1px solid var(--accent-border);
  background: linear-gradient(180deg, var(--surface2) 0%, var(--surface3) 100%);
}

.xp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.sec-lbl {
  font-size: 13px;
  font-weight: 900;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 10px;
}

.mini-tbl {
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.mini-tbl-body {
  max-height: 320px;
  overflow-y: auto;
}

.dp {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 24px;
}

.dp.modal {
  width: min(1180px, 96vw);
  max-height: 92vh;
  overflow: hidden;
}

.dp-head {
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--surface2);
}

.dp-title {
  font-size: 26px;
  font-weight: 900;
  color: var(--text);
  letter-spacing: .4px;
}

.dp-meta {
  font-size: 13px;
  color: var(--text3);
  font-weight: 700;
  margin-top: 4px;
}

.dp-close {
  background: var(--surface3);
  border: 1px solid var(--border2);
  color: var(--text2);
  border-radius: 10px;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
  font-weight: 900;
  transition: all .1s;
}

.dp-close:hover {
  background: var(--red-bg);
  color: var(--red);
  border-color: var(--red-border);
}

.dp-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border-bottom: 1px solid var(--border);
}

.dp-stat {
  padding: 14px 16px;
  background: var(--surface);
}

.dp-sl {
  font-size: 11px;
  font-weight: 800;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 4px;
}

.dp-sv {
  font-size: 20px;
  font-weight: 900;
  color: var(--text);
}

.dp-body {
  padding: 18px;
  max-height: calc(92vh - 170px);
  overflow-y: auto;
}

.ai-wrap { display: grid; grid-template-columns: 1.2fr .8fr; gap: 18px; }

.ai-msgs {
  overflow-y: auto;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 340px;
  max-height: 560px;
}

.ai-msg { display: flex; gap: 10px; align-items: flex-start; }
.ai-msg.user { flex-direction: row-reverse; }

.ai-av {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 900;
  flex-shrink: 0;
}

.ai-av.ai {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1.5px solid var(--accent-border);
}

.ai-av.user {
  background: var(--surface3);
  color: var(--text2);
  border: 1.5px solid var(--border2);
}

.ai-bub {
  max-width: 82%;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 15px;
  line-height: 1.7;
  font-weight: 600;
  white-space: pre-wrap;
}

.ai-bub.ai {
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border);
  border-top-left-radius: 4px;
}

.ai-bub.user {
  background: var(--accent);
  color: #fff;
  border-top-right-radius: 4px;
}

.ai-bar {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface2);
}

.ai-inp {
  flex: 1;
  padding: 11px 13px;
  border: 1px solid var(--border2);
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-family: var(--font);
  font-weight: 600;
  color: var(--text);
  background: var(--surface);
  outline: none;
  resize: none;
}

.ai-inp:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px rgba(37,99,235,.10);
}

.ai-send {
  padding: 11px 16px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 15px;
  font-weight: 900;
  font-family: var(--font);
  cursor: pointer;
  transition: background .15s;
}

.ai-send:hover { filter: brightness(1.05); }
.ai-send:disabled { opacity: .4; cursor: not-allowed; }

.ai-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 14px 16px 4px;
}

.ai-chip {
  padding: 7px 12px;
  border: 1.5px solid var(--border2);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 800;
  color: var(--text2);
  cursor: pointer;
  background: var(--surface);
  transition: all .1s;
}

.ai-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-bg);
}

.typing {
  display: flex;
  gap: 4px;
  align-items: center;
}

.typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text3);
  animation: blink 1.2s infinite;
}

.typing span:nth-child(2) { animation-delay: .2s; }
.typing span:nth-child(3) { animation-delay: .4s; }

@keyframes blink { 0%,80%,100% { opacity:.2 } 40% { opacity:1 } }

.cmp-inputs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 16px 18px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
}

.period-pill {
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 900;
}

.p-a {
  background: var(--accent-bg);
  color: var(--accent);
  border: 1.5px solid var(--accent-border);
}

.p-b {
  background: var(--surface3);
  color: var(--text2);
  border: 1.5px solid var(--border2);
}

.cmp-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border-bottom: 1px solid var(--border);
}

.cmp-cell {
  background: var(--surface);
  padding: 16px 18px;
}

.cmp-cl {
  font-size: 11px;
  font-weight: 800;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 6px;
}

.cmp-a {
  font-size: 12px;
  font-weight: 800;
  color: var(--accent);
  margin-bottom: 2px;
}

.cmp-av {
  font-size: 18px;
  font-weight: 900;
  color: var(--text);
  margin-bottom: 8px;
}

.cmp-b {
  font-size: 12px;
  font-weight: 800;
  color: var(--text3);
  margin-bottom: 2px;
}

.cmp-bv {
  font-size: 18px;
  font-weight: 900;
  color: var(--text2);
}

.delta {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 900;
  margin-top: 7px;
}

.d-p { background: var(--green-bg); color: var(--green); }
.d-n { background: var(--red-bg); color: var(--red); }

.empty {
  padding: 34px;
  text-align: center;
  color: var(--text3);
  font-size: 15px;
  font-weight: 700;
}

.no-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 12px;
  color: var(--text3);
  padding: 80px 24px;
  text-align: center;
}

.no-data-i { font-size: 52px; opacity: .35; }
.no-data-t { font-size: 24px; font-weight: 900; color: var(--text2); }

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 14px;
  color: var(--text3);
  padding: 80px 24px;
}

.spin {
  width: 34px;
  height: 34px;
  border: 3px solid var(--border2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin .65s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.err {
  margin: 16px 18px;
  padding: 12px 14px;
  background: var(--red-bg);
  border: 1px solid var(--red-border);
  border-radius: var(--radius-sm);
  color: var(--red);
  font-size: 14px;
  font-weight: 800;
}

.c-g { color: var(--green); }
.c-r { color: var(--red); }
.c-a { color: var(--amber); }

@media (max-width: 1100px) {
  .ov-grid,
  .xp-grid,
  .ai-wrap {
    grid-template-columns: 1fr;
  }

  .cmp-grid,
  .stats-bar,
  .dp-stats {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 720px) {
  .stats-bar,
  .cmp-grid,
  .dp-stats {
    grid-template-columns: 1fr;
  }

  .page { padding: 16px; }
  .topbar { padding: 14px 16px; }
  .brand { font-size: 22px; }
}
`;
// ─── Reusable ─────────────────────────────────────────────────────────────────

function MiniBar({ value, max, color }) {
    const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
    const c = color || (value >= 0 ? "#15803d" : "#b91c1c");
    return (
        <div className="bar-track">
            <div className="bar-fill" style={{ width: `${pct}%`, background: c }} />
        </div>
    );
}

function PBadge({ value }) {
    return <span className={`b ${value >= 0 ? "b-g" : "b-r"}`}>{fmt(value, true)}</span>;
}

// ─── Overview ─────────────────────────────────────────────────────────────────

function OverviewTab({ projects, rows }) {
    const topProfit = useMemo(() => [...projects].sort((a, b) => b.profit - a.profit).slice(0, 8), [projects]);
    const lossProjects = useMemo(() => projects.filter((p) => p.profit < 0).sort((a, b) => a.profit - b.profit), [projects]);
    const maxAbs = Math.max(...topProfit.map((p) => Math.abs(p.profit)), 1);

    const topSvc = useMemo(
        () => aggregateServiceSummary(rows).sort((a, b) => b.profit - a.profit).slice(0, 7),
        [rows]
    );

    const topPlates = useMemo(
        () => aggregatePlateSummary(rows).sort((a, b) => b.profit - a.profit).slice(0, 7),
        [rows]
    );

    const maxSvc = Math.max(...topSvc.map((s) => Math.abs(s.profit)), 1);
    const maxPlate = Math.max(...topPlates.map((p) => Math.abs(p.profit)), 1);

    return (
        <div className="page">
            <div className="pill-row">
                {[
                    { label: "Karlı Proje", val: projects.filter((p) => p.profit > 0).length, cls: "c-g" },
                    { label: "Zararlı Proje", val: lossProjects.length, cls: "c-r" },
                    { label: "Hizmet Türü", val: new Set(rows.map((r) => r.ServiceExpenseName)).size, cls: "" },
                    { label: "Toplam Kayıt", val: rows.length, cls: "" },
                ].map((x) => (
                    <div key={x.label} className="pill">
                        <div className="pill-lbl">{x.label}</div>
                        <div className={`pill-val ${x.cls}`}>{x.val}</div>
                    </div>
                ))}
            </div>

            <div className="ov-grid">
                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">🏆 En Karlı Projeler</div>
                            <div className="card-sub">Kara göre sıralı ilk 8 proje</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {topProfit.map((p) => (
                            <div className="bar-item" key={p.key}>
                                <div className="bar-info">
                                    <span className="bar-name" title={p.projectName}>{p.projectName}</span>
                                    <span className={`bar-v ${p.profit >= 0 ? "c-g" : "c-r"}`}>{fmt(p.profit, true)}</span>
                                </div>
                                <MiniBar value={p.profit} max={maxAbs} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">⚠️ Zararlı Projeler</div>
                            <div className="card-sub">{lossProjects.length === 0 ? "Bu dönemde zarar yok 🎉" : `${lossProjects.length} proje zararda`}</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {lossProjects.length === 0 ? (
                            <div className="empty">Tüm projeler bu dönemde karlı.</div>
                        ) : (
                            lossProjects.slice(0, 8).map((p) => (
                                <div className="bar-item" key={p.key}>
                                    <div className="bar-info">
                                        <span className="bar-name" title={p.projectName}>{p.projectName}</span>
                                        <span className="bar-v c-r">{fmt(p.profit, true)}</span>
                                    </div>
                                    <MiniBar value={p.profit} max={Math.abs(lossProjects[0]?.profit) || 1} color="#b91c1c" />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">📦 Hizmet / Masraf Katkısı</div>
                            <div className="card-sub">Kara göre sıralı ilk 7 hizmet</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {topSvc.map((s) => (
                            <div className="bar-item" key={s.name}>
                                <div className="bar-info">
                                    <span className="bar-name" title={s.name}>{s.name}</span>
                                    <span className={`bar-v ${s.profit >= 0 ? "c-g" : "c-r"}`}>{fmt(s.profit, true)}</span>
                                </div>
                                <MiniBar value={s.profit} max={maxSvc} color="#2563eb" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">🚗 Plaka Katkısı</div>
                            <div className="card-sub">Kara göre sıralı ilk 7 plaka</div>
                        </div>
                    </div>
                    <div className="card-body">
                        {topPlates.map((p) => (
                            <div className="bar-item" key={p.plate}>
                                <div className="bar-info">
                                    <span className="bar-name" style={{ fontWeight: 900 }}>{p.plate}</span>
                                    <span className={`bar-v ${p.profit >= 0 ? "c-g" : "c-r"}`}>{fmt(p.profit, true)}</span>
                                </div>
                                <MiniBar value={p.profit} max={maxPlate} color="#b45309" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Project Detail Tables ────────────────────────────────────────────────────

function ServiceBreakdown({ details, onPlateClick }) {
    const [svcF, setSvcF] = useState("");
    const [plateSearch, setPlateSearch] = useState("");

    const svcOpts = useMemo(
        () =>
            [...new Set(details.map((d) => d.ServiceExpense).filter((x) => x && x !== "-"))].sort((a, b) =>
                a.localeCompare(b, "tr")
            ),
        [details]
    );

    const filtered = useMemo(
        () => (svcF ? details.filter((d) => norm(d.ServiceExpense) === norm(svcF)) : details),
        [details, svcF]
    );

    const bySvc = useMemo(() => {
        const map = new Map();
        filtered.forEach((d) => {
            const k = d.ServiceExpenseName || "-";
            if (!map.has(k)) map.set(k, { name: k, p: 0, s: 0 });
            const g = map.get(k);
            g.p += d.PurchaseInvoiceIncome;
            g.s += d.SalesInvoceIncome;
        });
        return [...map.values()].map((x) => ({ ...x, profit: x.s - x.p })).sort((a, b) => b.profit - a.profit);
    }, [filtered]);

    const byPlate = useMemo(() => {
        const map = new Map();
        filtered.forEach((d) => {
            const k = d.PlateNumber || "-";
            if (!map.has(k)) map.set(k, { plate: k, p: 0, s: 0 });
            const g = map.get(k);
            g.p += d.PurchaseInvoiceIncome;
            g.s += d.SalesInvoceIncome;
        });

        return [...map.values()]
            .map((x) => ({ ...x, profit: x.s - x.p }))
            .filter((p) => norm(p.plate).includes(norm(plateSearch)))
            .sort((a, b) => b.profit - a.profit);
    }, [filtered, plateSearch]);

    return (
        <div className="xp-inner">
            <div className="f-row" style={{ marginBottom: 12 }}>
                <select className="f-sel" value={svcF} onChange={(e) => setSvcF(e.target.value)}>
                    <option value="">Tüm hizmetler</option>
                    {svcOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input
                    className="f-inp"
                    placeholder="Plaka filtrele..."
                    value={plateSearch}
                    onChange={(e) => setPlateSearch(e.target.value)}
                />
            </div>

            <div className="xp-grid">
                <div>
                    <div className="sec-lbl">Hizmet / Masraf ({bySvc.length})</div>
                    <div className="mini-tbl">
                        <div className="mini-tbl-body">
                            <table>
                                <thead>
                                    <tr>
                                        <th>İSİM</th>
                                        <th className="r">ALIŞ</th>
                                        <th className="r">SATIŞ</th>
                                        <th className="r">KAR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bySvc.length === 0 ? (
                                        <tr><td colSpan={4}><div className="empty">Veri yok</div></td></tr>
                                    ) : (
                                        bySvc.map((s) => (
                                            <tr key={s.name}>
                                                <td
                                                    style={{
                                                        maxWidth: 220,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        fontWeight: 800,
                                                    }}
                                                    title={s.name}
                                                >
                                                    {s.name}
                                                </td>
                                                <td className="r" style={{ color: "var(--text2)" }}>{fmt(s.p, true)}</td>
                                                <td className="r" style={{ fontWeight: 800 }}>{fmt(s.s, true)}</td>
                                                <td className="r"><PBadge value={s.profit} /></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div>
                    <div className="sec-lbl">Plaka ({byPlate.length})</div>
                    <div className="mini-tbl">
                        <div className="mini-tbl-body">
                            <table>
                                <thead>
                                    <tr>
                                        <th>PLAKA</th>
                                        <th className="r">ALIŞ</th>
                                        <th className="r">SATIŞ</th>
                                        <th className="r">KAR</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {byPlate.length === 0 ? (
                                        <tr><td colSpan={4}><div className="empty">Veri yok</div></td></tr>
                                    ) : (
                                        byPlate.map((p) => (
                                            <tr key={p.plate} className="clk" onClick={() => onPlateClick?.(p.plate)}>
                                                <td style={{ fontWeight: 900 }}>{p.plate}</td>
                                                <td className="r" style={{ color: "var(--text2)" }}>{fmt(p.p, true)}</td>
                                                <td className="r" style={{ fontWeight: 800 }}>{fmt(p.s, true)}</td>
                                                <td className="r"><PBadge value={p.profit} /></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Project Tab ──────────────────────────────────────────────────────────────

function ProjectTab({ projects, allRows }) {
    const [expanded, setExpanded] = useState(null);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("profit");
    const [selPlate, setSelPlate] = useState(null);

    const filtered = useMemo(() => {
        const s = [...projects].filter((p) => norm(p.projectName).includes(norm(search)));
        s.sort((a, b) =>
            sort === "profit"
                ? b.profit - a.profit
                : sort === "purchase"
                    ? b.purchaseTotal - a.purchaseTotal
                    : sort === "sales"
                        ? b.salesTotal - a.salesTotal
                        : b.plateCount - a.plateCount
        );
        return s;
    }, [projects, search, sort]);

    const totals = useMemo(
        () =>
            filtered.reduce(
                (a, p) => ({ p: a.p + p.purchaseTotal, s: a.s + p.salesTotal }),
                { p: 0, s: 0 }
            ),
        [filtered]
    );

    const maxAbs = Math.max(...filtered.map((p) => Math.abs(p.profit)), 1);

    return (
        <div className="page">
            <PlateDetailModal plateNumber={selPlate} allRows={allRows} onClose={() => setSelPlate(null)} />

            <div className="card">
                <div className="card-head">
                    <div className="f-row">
                        <div className="sb-search-wrap">
                            <span className="sb-icon">⌕</span>
                            <input
                                className="sb-search"
                                placeholder="Proje ara..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                style={{ width: 240 }}
                            />
                        </div>
                        <select className="f-sel" value={sort} onChange={(e) => setSort(e.target.value)}>
                            <option value="profit">Kara göre</option>
                            <option value="purchase">Alışa göre</option>
                            <option value="sales">Satışa göre</option>
                            <option value="plates">Plaka sayısına göre</option>
                        </select>
                        <span className="f-tag">{filtered.length} proje</span>
                    </div>
                </div>

                <div className="tbl-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: 40 }}></th>
                                <th>PROJE ADI</th>
                                <th className="c">PLAKA</th>
                                <th className="r">ALIŞ</th>
                                <th className="r">SATIŞ</th>
                                <th className="r">KAR / ZARAR</th>
                                <th style={{ width: 120 }}>ORAN</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7}><div className="empty">Proje bulunamadı.</div></td></tr>
                            ) : (
                                filtered.map((project) => {
                                    const isOpen = expanded === project.key;
                                    return (
                                        <>
                                            <tr
                                                key={project.key}
                                                className={`clk ${isOpen ? "xpnd" : ""}`}
                                                onClick={() => setExpanded((prev) => (prev === project.key ? null : project.key))}
                                            >
                                                <td style={{ color: "var(--text3)", fontSize: 11, fontWeight: 900 }}>{isOpen ? "▲" : "▼"}</td>
                                                <td style={{ fontWeight: 800, fontSize: 15 }}>{project.projectName}</td>
                                                <td className="c"><span className="b b-gr">{project.plateCount}</span></td>
                                                <td className="r" style={{ color: "var(--text2)", fontWeight: 700 }}>{fmt(project.purchaseTotal, true)}</td>
                                                <td className="r" style={{ fontWeight: 800 }}>{fmt(project.salesTotal, true)}</td>
                                                <td className="r"><PBadge value={project.profit} /></td>
                                                <td><MiniBar value={project.profit} max={maxAbs} /></td>
                                            </tr>

                                            {isOpen && (
                                                <tr key={`${project.key}-detail`}>
                                                    <td colSpan={7} className="xp-td">
                                                        <ServiceBreakdown details={project.details} onPlateClick={setSelPlate} />
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} style={{ paddingLeft: 20, color: "var(--text3)" }}>Genel Toplam</td>
                                <td className="r">{fmt(totals.p, true)}</td>
                                <td className="r">{fmt(totals.s, true)}</td>
                                <td className="r"><PBadge value={totals.s - totals.p} /></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ─── Plate Detail Modal ───────────────────────────────────────────────────────

function PlateDetailPanel({ plateNumber, allRows, onClose }) {
    const rows = useMemo(() => allRows.filter((r) => r.PlateNumber === plateNumber), [allRows, plateNumber]);

    const bySvc = useMemo(() => {
        const map = new Map();
        rows.forEach((r) => {
            const k = r.ServiceExpenseName || "-";
            if (!map.has(k)) map.set(k, { name: k, p: 0, s: 0, items: [] });
            const g = map.get(k);
            g.p += r.PurchaseInvoiceIncome;
            g.s += r.SalesInvoceIncome;
            g.items.push(r);
        });
        return [...map.values()].map((x) => ({ ...x, profit: x.s - x.p })).sort((a, b) => b.profit - a.profit);
    }, [rows]);

    const byProj = useMemo(() => {
        const map = new Map();
        rows.forEach((r) => {
            const k = r.ProjectName || "PROJESİZ";
            if (!map.has(k)) map.set(k, { name: k, p: 0, s: 0 });
            const g = map.get(k);
            g.p += r.PurchaseInvoiceIncome;
            g.s += r.SalesInvoceIncome;
        });
        return [...map.values()].map((x) => ({ ...x, profit: x.s - x.p })).sort((a, b) => b.profit - a.profit);
    }, [rows]);

    const total = useMemo(
        () => rows.reduce((a, r) => ({ p: a.p + r.PurchaseInvoiceIncome, s: a.s + r.SalesInvoceIncome }), { p: 0, s: 0 }),
        [rows]
    );

    return (
        <div className="dp modal">
            <div className="dp-head">
                <div>
                    <div className="dp-title">{plateNumber}</div>
                    <div className="dp-meta">
                        {rows.length} kayıt · {byProj.length} proje · {bySvc.length} hizmet türü
                    </div>
                </div>
                <button className="dp-close" onClick={onClose}>✕</button>
            </div>

            <div className="dp-stats">
                {[
                    { label: "Toplam Alış", val: fmt(total.p, true), cls: "" },
                    { label: "Toplam Satış", val: fmt(total.s, true), cls: "" },
                    { label: "Kar / Zarar", val: fmt(total.s - total.p, true), cls: total.s - total.p >= 0 ? "c-g" : "c-r" },
                    { label: "Toplam İşlem", val: rows.length, cls: "" },
                ].map((x) => (
                    <div key={x.label} className="dp-stat">
                        <div className="dp-sl">{x.label}</div>
                        <div className={`dp-sv ${x.cls}`}>{x.val}</div>
                    </div>
                ))}
            </div>

            <div className="dp-body">
                <div className="xp-grid">
                    <div>
                        <div className="sec-lbl">Hizmet Bazlı İşlemler</div>
                        <div className="mini-tbl">
                            <div className="mini-tbl-body">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>HİZMET</th>
                                            <th className="r">ALIŞ</th>
                                            <th className="r">SATIŞ</th>
                                            <th className="r">KAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bySvc.length === 0 ? (
                                            <tr><td colSpan={4}><div className="empty">Veri yok</div></td></tr>
                                        ) : (
                                            bySvc.map((s) => (
                                                <tr key={s.name}>
                                                    <td
                                                        style={{
                                                            fontSize: 14,
                                                            maxWidth: 220,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            fontWeight: 800,
                                                        }}
                                                        title={s.name}
                                                    >
                                                        {s.name}
                                                    </td>
                                                    <td className="r">{fmt(s.p, true)}</td>
                                                    <td className="r">{fmt(s.s, true)}</td>
                                                    <td className="r"><PBadge value={s.profit} /></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="sec-lbl">Proje Bazlı Dağılım</div>
                        <div className="mini-tbl">
                            <div className="mini-tbl-body">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>PROJE</th>
                                            <th className="r">ALIŞ</th>
                                            <th className="r">SATIŞ</th>
                                            <th className="r">KAR</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byProj.length === 0 ? (
                                            <tr><td colSpan={4}><div className="empty">Veri yok</div></td></tr>
                                        ) : (
                                            byProj.map((p) => (
                                                <tr key={p.name}>
                                                    <td
                                                        style={{
                                                            fontSize: 14,
                                                            maxWidth: 220,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                            fontWeight: 800,
                                                        }}
                                                        title={p.name}
                                                    >
                                                        {p.name}
                                                    </td>
                                                    <td className="r">{fmt(p.p, true)}</td>
                                                    <td className="r">{fmt(p.s, true)}</td>
                                                    <td className="r"><PBadge value={p.profit} /></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: 16 }}>
                    <div className="card-head">
                        <div>
                            <div className="card-title">📋 Yapılan İşlemler</div>
                            <div className="card-sub">Bu plakaya ait detay kayıtlar</div>
                        </div>
                    </div>
                    <div className="tbl-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>TARİH</th>
                                    <th>PROJE</th>
                                    <th>HİZMET</th>
                                    <th>TEDARİKÇİ</th>
                                    <th className="r">ALIŞ</th>
                                    <th className="r">SATIŞ</th>
                                    <th className="r">KAR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr><td colSpan={7}><div className="empty">Kayıt yok</div></td></tr>
                                ) : (
                                    rows.map((r) => {
                                        const profit = r.SalesInvoceIncome - r.PurchaseInvoiceIncome;
                                        return (
                                            <tr key={r.id}>
                                                <td>{r.TMSDespatchesDespatchDate ? new Date(r.TMSDespatchesDespatchDate).toLocaleDateString("tr-TR") : "-"}</td>
                                                <td style={{ fontWeight: 800 }}>{r.ProjectName}</td>
                                                <td>{r.ServiceExpenseName}</td>
                                                <td>{r.SupplierName}</td>
                                                <td className="r">{fmt(r.PurchaseInvoiceIncome, true)}</td>
                                                <td className="r">{fmt(r.SalesInvoceIncome, true)}</td>
                                                <td className="r"><PBadge value={profit} /></td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PlateDetailModal({ plateNumber, allRows, onClose }) {
    if (!plateNumber) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div onClick={(e) => e.stopPropagation()}>
                <PlateDetailPanel plateNumber={plateNumber} allRows={allRows} onClose={onClose} />
            </div>
        </div>
    );
}

// ─── Compare ──────────────────────────────────────────────────────────────────

function CompareTab() {
    const [pA, setPA] = useState({ start: "2026-02-01", end: "2026-02-28" });
    const [pB, setPB] = useState({ start: "2026-03-01", end: "2026-03-31" });
    const [dA, setDA] = useState(null);
    const [dB, setDB] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const fetchP = async (period) => {
        const resp = await fetch("http://localhost:5000/api/get-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                startDate: `${period.start}T00:00:00`,
                endDate: `${period.end}T23:59:59`,
                userId: 1,
            }),
        });

        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const result = await resp.json();
        const rows = normalizeRows(Array.isArray(result) ? result : []);
        const projs = aggregateByProject(rows);
        const plates = new Set(rows.map((r) => r.PlateNumber));
        const purchase = rows.reduce((a, r) => a + r.PurchaseInvoiceIncome, 0);
        const sales = rows.reduce((a, r) => a + r.SalesInvoceIncome, 0);

        return {
            rows,
            projs,
            purchase,
            sales,
            profit: sales - purchase,
            plateCount: plates.size,
        };
    };

    const compare = async () => {
        setLoading(true);
        setError("");
        try {
            const [a, b] = await Promise.all([fetchP(pA), fetchP(pB)]);
            setDA(a);
            setDB(b);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const labelA = monthLabel(pA.start, pA.end);
    const labelB = monthLabel(pB.start, pB.end);

    const projCmp = useMemo(() => {
        if (!dA || !dB) return [];

        const mA = new Map(dA.projs.map((p) => [p.key, p]));
        const mB = new Map(dB.projs.map((p) => [p.key, p]));
        const keys = new Set([...mA.keys(), ...mB.keys()]);

        return [...keys]
            .map((k) => ({
                name: k,
                aPurchase: mA.get(k)?.purchaseTotal || 0,
                aSales: mA.get(k)?.salesTotal || 0,
                aProfit: mA.get(k)?.profit || 0,
                bPurchase: mB.get(k)?.purchaseTotal || 0,
                bSales: mB.get(k)?.salesTotal || 0,
                bProfit: mB.get(k)?.profit || 0,
            }))
            .sort((a, b) => Math.abs(b.bProfit - b.aProfit) - Math.abs(a.bProfit - a.aProfit))
            .slice(0, 20);
    }, [dA, dB]);

    return (
        <div className="page">
            <div className="card">
                <div className="cmp-inputs">
                    <span className="period-pill p-a">{labelA}</span>
                    <input type="date" className="dinput" value={pA.start} onChange={(e) => setPA((p) => ({ ...p, start: e.target.value }))} />
                    <span className="dsep">—</span>
                    <input type="date" className="dinput" value={pA.end} onChange={(e) => setPA((p) => ({ ...p, end: e.target.value }))} />

                    <span style={{ margin: "0 10px", color: "var(--border2)", fontWeight: 900 }}>|</span>

                    <span className="period-pill p-b">{labelB}</span>
                    <input type="date" className="dinput" value={pB.start} onChange={(e) => setPB((p) => ({ ...p, start: e.target.value }))} />
                    <span className="dsep">—</span>
                    <input type="date" className="dinput" value={pB.end} onChange={(e) => setPB((p) => ({ ...p, end: e.target.value }))} />

                    <button className="btn-fetch" onClick={compare} disabled={loading}>
                        {loading ? "Yükleniyor..." : "Karşılaştır"}
                    </button>
                </div>

                {error && <div className="err">{error}</div>}

                {dA && dB && (
                    <>
                        <div className="cmp-grid">
                            {[
                                { label: "Toplam Alış", a: dA.purchase, b: dB.purchase },
                                { label: "Toplam Satış", a: dA.sales, b: dB.sales },
                                { label: "Net Kar", a: dA.profit, b: dB.profit },
                                { label: "Plaka Sayısı", a: dA.plateCount, b: dB.plateCount, num: true },
                            ].map((row) => {
                                const d = row.b - row.a;
                                const pct = row.a !== 0 ? ((d / Math.abs(row.a)) * 100).toFixed(1) : null;
                                return (
                                    <div key={row.label} className="cmp-cell">
                                        <div className="cmp-cl">{row.label}</div>
                                        <div className="cmp-a">{labelA}</div>
                                        <div className="cmp-av">{row.num ? row.a : fmt(row.a, true)}</div>
                                        <div className="cmp-b">{labelB}</div>
                                        <div className="cmp-bv">{row.num ? row.b : fmt(row.b, true)}</div>
                                        <div className={`delta ${d >= 0 ? "d-p" : "d-n"}`}>
                                            {d >= 0 ? "+" : ""}
                                            {row.num ? d : fmt(d, true)}
                                            {pct !== null ? ` · %${pct}` : ""}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="card-head" style={{ borderTop: "1px solid var(--border)" }}>
                            <div>
                                <div className="card-title">📊 Proje Bazlı Karşılaştırma</div>
                                <div className="card-sub">{labelA} ve {labelB} dönemlerine göre alış / satış / kar farkları</div>
                            </div>
                        </div>

                        <div className="tbl-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>PROJE</th>
                                        <th className="r">{labelA} ALIŞ</th>
                                        <th className="r">{labelA} SATIŞ</th>
                                        <th className="r">{labelA} KAR</th>
                                        <th className="r">{labelB} ALIŞ</th>
                                        <th className="r">{labelB} SATIŞ</th>
                                        <th className="r">{labelB} KAR</th>
                                        <th className="r">DEĞİŞİM</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projCmp.length === 0 ? (
                                        <tr><td colSpan={8}><div className="empty">Karşılaştırma verisi yok.</div></td></tr>
                                    ) : (
                                        projCmp.map((p) => {
                                            const d = p.bProfit - p.aProfit;
                                            return (
                                                <tr key={p.name}>
                                                    <td style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</td>
                                                    <td className="r">{fmt(p.aPurchase, true)}</td>
                                                    <td className="r">{fmt(p.aSales, true)}</td>
                                                    <td className="r"><PBadge value={p.aProfit} /></td>
                                                    <td className="r">{fmt(p.bPurchase, true)}</td>
                                                    <td className="r">{fmt(p.bSales, true)}</td>
                                                    <td className="r"><PBadge value={p.bProfit} /></td>
                                                    <td className="r">
                                                        <span className={`delta ${d >= 0 ? "d-p" : "d-n"}`}>
                                                            {d >= 0 ? "+" : ""}
                                                            {fmt(d, true)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {!dA && !dB && !loading && (
                    <div className="empty" style={{ padding: 46 }}>
                        İki dönem seçip karşılaştırma başlatın.
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────

function answerFromData(question, projects, rows) {
    const q = norm(question);

    const totalPurchase = rows.reduce((a, r) => a + r.PurchaseInvoiceIncome, 0);
    const totalSales = rows.reduce((a, r) => a + r.SalesInvoceIncome, 0);
    const totalProfit = totalSales - totalPurchase;

    const sortedProjects = [...projects].sort((a, b) => b.profit - a.profit);
    const profitableProjects = projects.filter((p) => p.profit > 0);
    const lossProjects = [...projects].filter((p) => p.profit < 0).sort((a, b) => a.profit - b.profit);
    const bestProject = sortedProjects[0];
    const worstProject = [...projects].sort((a, b) => a.profit - b.profit)[0];

    const plates = aggregatePlateSummary(rows).sort((a, b) => b.profit - a.profit);
    const services = aggregateServiceSummary(rows).sort((a, b) => b.profit - a.profit);
    const bestPlate = plates[0];
    const worstPlate = [...plates].sort((a, b) => a.profit - b.profit)[0];
    const bestService = services[0];
    const worstService = [...services].sort((a, b) => a.profit - b.profit)[0];

    const projectMention = projects.find((p) => q.includes(norm(p.projectName)));
    const plateMention = plates.find((p) => q.includes(norm(p.plate)));

    if (rows.length === 0) {
        return "Henüz analiz edilecek veri yok. Önce tarih aralığı seçip veri yüklemelisin.";
    }

    if (projectMention) {
        return `${projectMention.projectName} projesinde alış ${fmt(projectMention.purchaseTotal)}, satış ${fmt(projectMention.salesTotal)}, net sonuç ${fmt(projectMention.profit)}. Bu projede ${projectMention.plateCount} farklı plaka var.`;
    }

    if (plateMention) {
        return `${plateMention.plate} plakasında alış ${fmt(plateMention.p)}, satış ${fmt(plateMention.s)}, net sonuç ${fmt(plateMention.profit)}. ${plateMention.projects.size} projede ve ${plateMention.services.size} hizmet türünde işlem görünüyor.`;
    }

    if (q.includes("özet") || q.includes("genel durum") || q.includes("toplam")) {
        return `Genel özet şöyle:
• Toplam alış: ${fmt(totalPurchase)}
• Toplam satış: ${fmt(totalSales)}
• Net kar: ${fmt(totalProfit)}
• Toplam proje: ${projects.length}
• Karlı proje: ${profitableProjects.length}
• Zararlı proje: ${lossProjects.length}
• Toplam plaka: ${plates.length}`;
    }

    if (q.includes("en karlı proje") || q.includes("hangi proje en karlı") || q.includes("en iyi proje")) {
        return bestProject
            ? `En karlı proje ${bestProject.projectName}. Alış ${fmt(bestProject.purchaseTotal)}, satış ${fmt(bestProject.salesTotal)}, net kar ${fmt(bestProject.profit)}.`
            : "Proje verisi bulunamadı.";
    }

    if (q.includes("zararlı proje") || q.includes("en kötü proje")) {
        return worstProject
            ? `En düşük performanslı proje ${worstProject.projectName}. Alış ${fmt(worstProject.purchaseTotal)}, satış ${fmt(worstProject.salesTotal)}, net sonuç ${fmt(worstProject.profit)}.`
            : "Zararlı proje bulunamadı.";
    }

    if (q.includes("en iyi plaka") || q.includes("en karlı plaka")) {
        return bestPlate
            ? `En iyi plaka ${bestPlate.plate}. Alış ${fmt(bestPlate.p)}, satış ${fmt(bestPlate.s)}, net kar ${fmt(bestPlate.profit)}.`
            : "Plaka verisi bulunamadı.";
    }

    if (q.includes("en kötü plaka") || q.includes("zararlı plaka")) {
        return worstPlate
            ? `En zayıf plaka ${worstPlate.plate}. Alış ${fmt(worstPlate.p)}, satış ${fmt(worstPlate.s)}, net sonuç ${fmt(worstPlate.profit)}.`
            : "Zararlı plaka bulunamadı.";
    }

    if (q.includes("hizmet") || q.includes("masraf")) {
        const top3 = services.slice(0, 3);
        return `Hizmet bazında en güçlü alanlar:
${top3.map((s, i) => `${i + 1}. ${s.name} → alış ${fmt(s.p)}, satış ${fmt(s.s)}, net ${fmt(s.profit)}`).join("\n")}
${worstService ? `En zayıf hizmet alanı ise ${worstService.name}; net sonuç ${fmt(worstService.profit)}.` : ""}`;
    }

    if (q.includes("öneri") || q.includes("ne yapalım") || q.includes("aksiyon")) {
        const rec = [];
        if (lossProjects.length > 0) rec.push(`Zararlı projeler içinde ilk odak noktası: ${lossProjects[0].projectName}.`);
        if (worstPlate && worstPlate.profit < 0) rec.push(`Zarar eden plaka ${worstPlate.plate} için hizmet bazlı maliyet kırılımı incelenmeli.`);
        if (worstService && worstService.profit < 0) rec.push(`Zarar üreten hizmet kalemi ${worstService.name}; fiyatlama ve tedarikçi tarafı gözden geçirilmeli.`);
        if (bestProject) rec.push(`En karlı proje ${bestProject.projectName}; benzer operasyon modeli diğer projelerde referans alınabilir.`);
        return rec.join("\n");
    }

    return `Bu soruya mevcut proje tablosundaki veriye göre cevap veriyorum:
• Toplam alış: ${fmt(totalPurchase)}
• Toplam satış: ${fmt(totalSales)}
• Net kar: ${fmt(totalProfit)}
• En karlı proje: ${bestProject?.projectName || "-"}
• En iyi plaka: ${bestPlate?.plate || "-"}
Daha net bir soru sorarsan proje, plaka veya hizmet bazında detay verebilirim.`;
}

function AITab({ projects, rows }) {
    const [messages, setMessages] = useState([
        {
            role: "ai",
            text: "Merhaba. Mevcut proje verilerine göre analiz yapıyorum. Karlı/zararlı projeler, plaka performansı, hizmet bazlı sonuçlar ve öneriler sorabilirsin.",
        },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const summary = useMemo(() => {
        const totalP = rows.reduce((a, r) => a + r.PurchaseInvoiceIncome, 0);
        const totalS = rows.reduce((a, r) => a + r.SalesInvoceIncome, 0);
        const totalProfit = totalS - totalP;
        const bestProject = [...projects].sort((a, b) => b.profit - a.profit)[0];
        const bestPlate = aggregatePlateSummary(rows).sort((a, b) => b.profit - a.profit)[0];
        return {
            totalP,
            totalS,
            totalProfit,
            bestProject,
            bestPlate,
        };
    }, [projects, rows]);

    const ask = (text) => {
        setInput(text);
    };

    const send = useCallback(() => {
        const userText = input.trim();
        if (!userText) return;

        setMessages((prev) => [...prev, { role: "user", text: userText }]);
        setLoading(true);

        setTimeout(() => {
            const answer = answerFromData(userText, projects, rows);
            setMessages((prev) => [...prev, { role: "ai", text: answer }]);
            setInput("");
            setLoading(false);
        }, 250);
    }, [input, projects, rows]);

    return (
        <div className="page">
            <div className="ai-wrap">
                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">🤖 AI Analiz</div>
                            <div className="card-sub">Cevaplar proje ve kayıt verilerine göre üretilir</div>
                        </div>
                    </div>

                    <div className="ai-chips">
                        {[
                            "Genel özet ver",
                            "En karlı proje hangisi?",
                            "Zararlı projeleri söyle",
                            "En karlı plaka hangisi?",
                            "Hizmet bazında özet ver",
                            "Aksiyon önerisi ver",
                        ].map((chip) => (
                            <button key={chip} className="ai-chip" onClick={() => ask(chip)}>
                                {chip}
                            </button>
                        ))}
                    </div>

                    <div className="ai-msgs">
                        {messages.map((m, i) => (
                            <div key={i} className={`ai-msg ${m.role === "user" ? "user" : ""}`}>
                                <div className={`ai-av ${m.role === "user" ? "user" : "ai"}`}>
                                    {m.role === "user" ? "S" : "AI"}
                                </div>
                                <div className={`ai-bub ${m.role === "user" ? "user" : "ai"}`}>
                                    {m.text}
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="ai-msg">
                                <div className="ai-av ai">AI</div>
                                <div className="ai-bub ai">
                                    <div className="typing"><span></span><span></span><span></span></div>
                                </div>
                            </div>
                        )}

                        <div ref={endRef} />
                    </div>

                    <div className="ai-bar">
                        <textarea
                            rows={2}
                            className="ai-inp"
                            placeholder="Sorunu yaz..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    send();
                                }
                            }}
                        />
                        <button className="ai-send" onClick={send} disabled={loading || !input.trim()}>
                            Gönder
                        </button>
                    </div>
                </div>

                <div className="card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">📌 Analiz Çıktıları</div>
                            <div className="card-sub">Öne çıkan sonuçlar</div>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="pill-row" style={{ flexDirection: "column" }}>
                            <div className="pill">
                                <div className="pill-lbl">Toplam Alış</div>
                                <div className="pill-val">{fmt(summary.totalP, true)}</div>
                            </div>
                            <div className="pill">
                                <div className="pill-lbl">Toplam Satış</div>
                                <div className="pill-val">{fmt(summary.totalS, true)}</div>
                            </div>
                            <div className="pill">
                                <div className="pill-lbl">Net Kar</div>
                                <div className={`pill-val ${summary.totalProfit >= 0 ? "c-g" : "c-r"}`}>
                                    {fmt(summary.totalProfit, true)}
                                </div>
                            </div>
                            <div className="pill">
                                <div className="pill-lbl">En Karlı Proje</div>
                                <div className="pill-val" style={{ fontSize: 22 }}>
                                    {summary.bestProject?.projectName || "-"}
                                </div>
                            </div>
                            <div className="pill">
                                <div className="pill-lbl">En İyi Plaka</div>
                                <div className="pill-val" style={{ fontSize: 22 }}>
                                    {summary.bestPlate?.plate || "-"}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Anasayfa() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [startDate, setStartDate] = useState("2026-03-23");
    const [endDate, setEndDate] = useState("2026-03-23");
    const [tab, setTab] = useState(0);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const resp = await fetch("http://localhost:5000/api/get-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate: `${startDate}T00:00:00`,
                    endDate: `${endDate}T23:59:59`,
                    userId: 1,
                }),
            });

            if (!resp.ok) throw new Error(`Hata: ${resp.status}`);

            const result = await resp.json();
            setRows(normalizeRows(Array.isArray(result) ? result : []));
        } catch (err) {
            setRows([]);
            setError(err.message || "Veri alınamadı.");
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const projects = useMemo(() => aggregateByProject(rows), [rows]);

    const stats = useMemo(() => {
        const plates = new Set(rows.map((r) => r.PlateNumber));
        const totals = rows.reduce(
            (a, r) => ({
                p: a.p + r.PurchaseInvoiceIncome,
                s: a.s + r.SalesInvoceIncome,
            }),
            { p: 0, s: 0 }
        );

        return {
            purchase: totals.p,
            sales: totals.s,
            profit: totals.s - totals.p,
            plates: plates.size,
            projCount: projects.length,
        };
    }, [rows, projects]);

    const TABS = [
        { label: "Ana Sayfa", icon: "🏠" },
        { label: "Muhasebe Verisi", icon: "💰" },
        { label: "İK Verisi", icon: "👥" },
        { label: "Proje", icon: "📁" },
        { label: "Kullanıcı", icon: "🙍" },
    ];
    return (
        <div className="app">
            <style>{STYLE}</style>

            <div className="header">
                <div className="header-top">
                    <div>
                        <div className="header-title">Operasyon Paneli</div>
                        <div className="header-sub">Muhasebe, İK, proje ve kullanıcı verileri tek ekranda</div>
                    </div>

                    <div className="header-actions">
                        <span className="dlabel">Başlangıç</span>
                        <input
                            className="dinput"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />

                        <span className="dlabel">Bitiş</span>
                        <input
                            className="dinput"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />

                        <button className="btn-fetch" onClick={fetchData} disabled={loading}>
                            {loading ? "Yükleniyor..." : "Veri Getir"}
                        </button>
                    </div>
                </div>

                <div className="top-nav">
                    {TABS.map((t, i) => (
                        <div
                            key={t.label}
                            className={`top-nav-item ${tab === i ? "active" : ""}`}
                            onClick={() => setTab(i)}
                        >
                            <span>{t.icon}</span>
                            <span>{t.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="body">
                {loading ? (
                    <div className="loading">
                        <div className="spin" />
                        <div>Veriler yükleniyor...</div>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="no-data">
                        <div className="no-data-i">📭</div>
                        <div className="no-data-t">Gösterilecek veri yok</div>
                        <div>Tarih aralığını değiştirip tekrar deneyin.</div>
                        {error && <div className="err" style={{ margin: 0 }}>{error}</div>}
                    </div>
                ) : (
                    <div className="content">
                        {error && <div className="err">{error}</div>}

                        <div className="stats-bar">
                            <div className="stat-cell">
                                <div className="stat-lbl">Toplam Alış</div>
                                <div className="stat-val">{fmt(stats.purchase, true)}</div>
                            </div>
                            <div className="stat-cell">
                                <div className="stat-lbl">Toplam Satış</div>
                                <div className="stat-val">{fmt(stats.sales, true)}</div>
                            </div>
                            <div className="stat-cell">
                                <div className="stat-lbl">Net Kar</div>
                                <div className={`stat-val ${stats.profit >= 0 ? "g" : "r"}`}>
                                    {fmt(stats.profit, true)}
                                </div>
                            </div>
                            <div className="stat-cell">
                                <div className="stat-lbl">Proje / Plaka</div>
                                <div className="stat-val">
                                    {stats.projCount} / {stats.plates}
                                </div>
                            </div>
                        </div>

                        <div className="tabs">
                            {TABS.map((t, i) => (
                                <div
                                    key={t.label}
                                    className={`tab ${tab === i ? "active" : ""}`}
                                    onClick={() => setTab(i)}
                                >
                                    <span>{t.icon}</span>
                                    <span>{t.label}</span>
                                </div>
                            ))}
                        </div>

                        {tab === 0 && <OverviewTab projects={projects} rows={rows} />}
                        {tab === 1 && <ProjectTab projects={projects} allRows={rows} />}
                        {tab === 2 && <CompareTab />}
                        {tab === 3 && <AITab projects={projects} rows={rows} />}
                    </div>
                )}
            </div>
        </div>
    );
}