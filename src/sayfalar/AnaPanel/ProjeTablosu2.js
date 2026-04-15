import React, { useMemo, useState, useEffect, useRef } from "react";
import "./ProjeTablosu2.css";
import PlateDetailModal2 from "./PlakaDetayPenceresi2";
// ─── helpers ────────────────────────────────────────────────────────────────
const norm = (s) => String(s || "").toLocaleLowerCase("tr");
const fmt = (n, sym = false) => {
    const v = Number(n || 0);
    return (sym ? "₺" : "") + v.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};
const pctLabel = (v) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";

// ─── Chart (Chart.js via CDN, loaded once) ──────────────────────────────────
function useChartJs(callback, deps) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);
    useEffect(() => {
        if (!canvasRef.current) return;
        if (!window.Chart) return;
        if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
        chartRef.current = callback(canvasRef.current);
        return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return canvasRef;
}

function BarChart({ list }) {
    const labels = list.map((p) => p.projectName.length > 16 ? p.projectName.slice(0, 15) + "…" : p.projectName);
    const purData = list.map((p) => p.purch);
    const salData = list.map((p) => p.salesTotal);
    const ref = useChartJs((canvas) => new window.Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [
                { label: "Alış", data: purData, backgroundColor: "#378ADD", borderRadius: 4, borderSkipped: false },
                { label: "Satış", data: salData, backgroundColor: "#639922", borderRadius: 4, borderSkipped: false },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmt(c.raw, true) } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#888780", maxRotation: 30 } },
                y: { grid: { color: "rgba(0,0,0,.05)" }, ticks: { font: { size: 11 }, color: "#888780", callback: (v) => "₺" + Math.round(v / 1000) + "K" } },
            },
        },
    }), [list]);
    return <canvas ref={ref} />;
}

function DonutChart({ list }) {
    const profitable = list.filter((p) => p.profit > 0);
    const pieLabels = profitable.map((p) => p.projectName.length > 14 ? p.projectName.slice(0, 13) + "…" : p.projectName);
    const pieData = profitable.map((p) => p.profit);
    const PALETTE = ["#378ADD", "#639922", "#D85A30", "#BA7517", "#7F77DD", "#0F6E56"];
    const ref = useChartJs((canvas) => new window.Chart(canvas, {
        type: "doughnut",
        data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: PALETTE, borderWidth: 2, borderColor: "#fff", hoverOffset: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: "66%",
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => " " + fmt(c.raw, true) } } },
        },
    }), [list]);
    return (
        <>
            <canvas ref={ref} />
            <div className="donut-legend">
                {pieLabels.map((l, i) => (
                    <span key={l} className="leg-item">
                        <span className="leg-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {l}
                    </span>
                ))}
            </div>
        </>
    );
}

// ─── KPI strip ──────────────────────────────────────────────────────────────
function KpiGrid({ list }) {
    const totP = list.reduce((s, p) => s + p.purch, 0);
    const totS = list.reduce((s, p) => s + p.salesTotal, 0);
    const totProfit = totS - totP;
    const profR = totS > 0 ? totProfit / totS : 0;
    const totPlates = list.reduce((s, p) => s + p.plateCount, 0);
    return (
        <div className="kpi-grid">
            <div className="kpi">
                <div className="kpi-label">Toplam satış</div>
                <div className="kpi-value mono">{fmt(totS, true)}</div>
                <div className="kpi-sub">{list.length} proje</div>
            </div>
            <div className="kpi">
                <div className="kpi-label">Toplam alış</div>
                <div className="kpi-value mono">{fmt(totP, true)}</div>
                <div className="kpi-sub">Dağılım dahil</div>
            </div>
            <div className="kpi">
                <div className="kpi-label">Net kâr</div>
                <div className="kpi-value mono">{fmt(totProfit, true)}</div>
                <div className="kpi-sub">
                    <span className={`kpi-delta ${profR >= 0 ? "up" : "dn"}`}>{pctLabel(profR)} karlılık</span>
                </div>
            </div>
            <div className="kpi">
                <div className="kpi-label">Aktif araç</div>
                <div className="kpi-value">{totPlates}</div>
                <div className="kpi-sub">Toplam plaka</div>
            </div>
        </div>
    );
}

// ─── Expand detail ───────────────────────────────────────────────────────────
function getBySvc(details) {
    const map = new Map();
    (details || []).forEach((d) => {
        const k = d.ServiceExpenseName || d.ServiceExpense || "-";
        if (!map.has(k)) map.set(k, { name: k, p: 0, s: 0 });
        const g = map.get(k);
        g.p += Number(d.PurchaseInvoiceIncome || 0);
        g.s += Number(d.SalesInvoceIncome || 0);
    });
    return [...map.values()].map((x) => ({ ...x, profit: x.s - x.p })).sort((a, b) => b.p - a.p);
}

function getPlates(details) {
    return [...new Set((details || []).map((d) => d.PlateNumber || "-"))].sort((a, b) => a.localeCompare(b, "tr"));
}

function ServicePanel({ bySvc }) {
    const maxP = Math.max(...bySvc.map((s) => s.p), 1);
    const maxS = Math.max(...bySvc.map((s) => s.s), 1);
    return (
        <div className="panel">
            <div className="panel-head">
                <IconBar />
                <div className="panel-title">Hizmet / masraf</div>
                <div className="panel-count">{bySvc.length} kalem</div>
            </div>
            {bySvc.length === 0 ? (
                <div className="panel-empty">Veri yok</div>
            ) : (
                bySvc.map((s) => (
                    <div className="svc-item" key={s.name}>
                        <div className="svc-item-top">
                            <div className="svc-item-name">{s.name}</div>
                            <span className={`pill ${s.profit >= 0 ? "pos" : "neg"}`}>
                                {s.profit >= 0 ? "+" : ""}{fmt(s.profit, true)}
                            </span>
                        </div>
                        <div className="svc-bar-row">
                            <span className="bar-lbl">Alış</span>
                            <div className="bar-wrap"><div className="bar-fill blue" style={{ width: Math.round(s.p / maxP * 100) + "%" }} /></div>
                            <span className="bar-val">{fmt(s.p, true)}</span>
                        </div>
                        <div className="svc-bar-row">
                            <span className="bar-lbl">Satış</span>
                            <div className="bar-wrap"><div className="bar-fill green" style={{ width: Math.round(s.s / maxS * 100) + "%" }} /></div>
                            <span className="bar-val">{fmt(s.s, true)}</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function DagilimPanel({ dag }) {
    const maxDag = Math.max(...dag.map((d) => Number(d.dagitilan_tutar || 0)), 1);
    return (
        <div className="panel">
            <div className="panel-head">
                <IconClock />
                <div className="panel-title">Proje dağılım</div>
                <div className="panel-count">{dag.length} kayıt</div>
            </div>
            {dag.length === 0 ? (
                <div className="panel-empty">Dağılım verisi yok</div>
            ) : (
                dag.map((item) => (
                    <div className="dag-item" key={item.id || item.hesap_adi}>
                        <div className="dag-title">{item.hesap_adi}</div>
                        <div className="dag-sub">Kullanıcı: {item.kullanici_adi}</div>
                        <div className="dag-bar-row">
                            <div className="bar-wrap"><div className="bar-fill purple" style={{ width: Math.round(Number(item.dagitilan_tutar) / maxDag * 100) + "%" }} /></div>
                            <div className="dag-pct">%{Number(item.dagilim_yuzde).toFixed(1)}</div>
                        </div>
                        <div className="dag-nums">
                            <div className="dag-num">
                                <div className="dag-num-lbl">Orijinal</div>
                                <div className="dag-num-val">{fmt(item.orijinal_tutar, true)}</div>
                            </div>
                            <div className="dag-num">
                                <div className="dag-num-lbl">Dağıtılan</div>
                                <div className="dag-num-val">{fmt(item.dagitilan_tutar, true)}</div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function PlatePanel({ plates, onPlateClick }) {
    return (
        <div className="panel">
            <div className="panel-head">
                <IconPlate />
                <div className="panel-title">Plakalar</div>
                <div className="panel-count">{plates.length} araç</div>
            </div>
            {plates.length === 0 ? (
                <div className="panel-empty">Veri yok</div>
            ) : (
                <div className="plate-grid">
                    {plates.map((pl) => (
                        <button key={pl} className="plate-btn" onClick={() => onPlateClick?.(pl)}>{pl}</button>
                    ))}
                </div>
            )}
        </div>
    );
}

function ExpandRow({ project, projeDagilimRows, onPlateClick, selectedMonth }) {
    const [svcFilter, setSvcFilter] = useState("");
    const [plateSearch, setPlateSearch] = useState("");

    const bySvc = useMemo(() => {
        let list = getBySvc(project.details);
        if (svcFilter) list = list.filter((s) => s.name === svcFilter);
        return list;
    }, [project.details, svcFilter]);

    const svcOpts = useMemo(() => getBySvc(project.details).map((s) => s.name), [project.details]);

    const dag = useMemo(() => {
        if (!Array.isArray(projeDagilimRows)) return project.dagilim || [];
        const fromRows = projeDagilimRows.filter(
            (r) =>
                norm(r.reel_proje_adi) === norm(project.projectName) &&
                (!selectedMonth || String(r.donem_ayi || "") === String(selectedMonth))
        );
        return fromRows.length > 0 ? fromRows : (project.dagilim || []);
    }, [projeDagilimRows, project, selectedMonth]);

    const plates = useMemo(() => {
        const all = getPlates(project.details);
        return plateSearch ? all.filter((pl) => norm(pl).includes(norm(plateSearch))) : all;
    }, [project.details, plateSearch]);

    return (
        <tr>
            <td colSpan={7} className="expand-td">
                <div className="expand-inner">
                    <div className="exp-toolbar">
                        <select value={svcFilter} onChange={(e) => setSvcFilter(e.target.value)}>
                            <option value="">Tüm hizmetler</option>
                            {svcOpts.map((o) => <option key={o}>{o}</option>)}
                        </select>
                        <input
                            placeholder="Plaka filtrele…"
                            value={plateSearch}
                            onChange={(e) => setPlateSearch(e.target.value)}
                        />
                    </div>
                    <div className="exp-grid">
                        <ServicePanel bySvc={bySvc} />
                        <DagilimPanel dag={dag} />
                        <PlatePanel plates={plates} onPlateClick={onPlateClick} />
                    </div>
                </div>
            </td>
        </tr>
    );
}
// ─── Tiny inline SVG icons ───────────────────────────────────────────────────
const IconBar = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="3" width="6" height="18" rx="1" /><rect x="9" y="8" width="6" height="13" rx="1" /><rect x="16" y="13" width="6" height="8" rx="1" />
    </svg>
);
const IconClock = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
    </svg>
);
const IconPlate = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="2" y="7" width="20" height="10" rx="2" /><path d="M7 11h.01M17 11h.01" />
    </svg>
);
const IconChev = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ width: 12, height: 12 }}>
        <path d="M6 9l6 6 6-6" />
    </svg>
);

// ─── Main table ──────────────────────────────────────────────────────────────
function enrich(p, projeDagilimRows, selectedMonth) {
    const dagRows = Array.isArray(projeDagilimRows)
        ? projeDagilimRows.filter((r) =>
            norm(r.reel_proje_adi) === norm(p.projectName) &&
            (!selectedMonth || String(r.donem_ayi || "") === String(selectedMonth))
        )
        : (p.dagilim || []);

    const dagSum = dagRows.reduce((s, r) => s + Number(r.dagitilan_tutar || 0), 0);
    const purch = Number(p.purchaseTotal || 0) + dagSum;
    const profit = Number(p.salesTotal || 0) - purch;

    return { ...p, dagSum, purch, profit };
}
export default function ProjeTablosu2({
    projects = [],
    allRows = [],
    projeDagilimRows = [],
    selectedMonth,
}) {
    const [expanded, setExpanded] = useState(null);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("profit");
    const [selPlate, setSelPlate] = useState(null);
    const [chartJsReady, setChartJsReady] = useState(!!window.Chart);

    useEffect(() => {
        if (window.Chart) {
            setChartJsReady(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
        script.onload = () => setChartJsReady(true);
        document.head.appendChild(script);
    }, []);

    const enriched = useMemo(
        () => projects.map((p) => enrich(p, projeDagilimRows, selectedMonth)),
        [projects, projeDagilimRows, selectedMonth]
    );

    const filtered = useMemo(() => {
        const list = enriched.filter((p) => norm(p.projectName).includes(norm(search)));
        list.sort((a, b) =>
            sort === "purchase" ? b.purch - a.purch :
                sort === "sales" ? b.salesTotal - a.salesTotal :
                    sort === "plates" ? b.plateCount - a.plateCount :
                        b.profit - a.profit
        );
        return list;
    }, [enriched, search, sort]);

    const totals = useMemo(() => filtered.reduce((acc, p) => ({ p: acc.p + p.purch, s: acc.s + p.salesTotal }), { p: 0, s: 0 }), [filtered]);
    const totalProfit = totals.s - totals.p;
    const totalProfR = totals.s > 0 ? totalProfit / totals.s : 0;

    const toggle = (key) => setExpanded((prev) => prev === key ? null : key);

    return (
        <div className="pt-app">
            <PlateDetailModal2
                plateNumber={selPlate}
                allRows={allRows}
                onClose={() => setSelPlate(null)}
            />

            <KpiGrid list={filtered} />
            <div className="chart-row">
                <div className="chart-card">
                    <div className="chart-title">Proje bazlı karlılık</div>
                    <div className="chart-sub">Alış · Satış karşılaştırması (₺)</div>
                    <div className="legend">
                        <span className="leg-item"><span className="leg-dot" style={{ background: "#378ADD" }} />Alış</span>
                        <span className="leg-item"><span className="leg-dot" style={{ background: "#639922" }} />Satış</span>
                    </div>
                    <div className="chart-canvas-wrap">
                        {chartJsReady && <BarChart list={filtered} />}
                    </div>
                </div>
                <div className="chart-card">
                    <div className="chart-title">Kâr dağılımı</div>
                    <div className="chart-sub">Proje başına kâr payı</div>
                    <div className="chart-canvas-wrap">
                        {chartJsReady && <DonutChart list={filtered} />}
                    </div>
                </div>
            </div>

            <div className="pt-card">
                <div className="toolbar">
                    <div className="search-wrap">
                        <span className="search-icon">⌕</span>
                        <input className="search-inp" placeholder="Proje ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <select value={sort} onChange={(e) => setSort(e.target.value)}>
                        <option value="profit">Kâra göre</option>
                        <option value="purchase">Alışa göre</option>
                        <option value="sales">Satışa göre</option>
                        <option value="plates">Plakaya göre</option>
                    </select>
                    <span className="count-badge">{filtered.length} proje</span>
                </div>

                <div className="tbl-wrap">
                    <table className="pt-table">
                        <thead>
                            <tr>
                                <th style={{ width: 38 }}></th>
                                <th>Proje adı</th>
                                <th className="c" style={{ width: 80 }}>Araç</th>
                                <th className="r" style={{ width: 130 }}>Alış</th>
                                <th className="r" style={{ width: 130 }}>Satış</th>
                                <th className="r" style={{ width: 140 }}>Kâr / Zarar</th>
                                <th className="r" style={{ width: 100 }}>Karlılık</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7}><div className="panel-empty">Proje bulunamadı</div></td></tr>
                            ) : (
                                filtered.map((p) => {
                                    const isOpen = expanded === p.key;
                                    const profR = p.salesTotal > 0 ? p.profit / p.salesTotal : 0;
                                    return (
                                        <React.Fragment key={p.key}>
                                            <tr className={`main-row${isOpen ? " open" : ""}`} onClick={() => toggle(p.key)}>
                                                <td>
                                                    <span className="chev">
                                                        <IconChev />
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="prj-name">{p.projectName}</div>
                                                    <div className="prj-meta">{p.plateCount} araç · {(p.details || []).length} kayıt · {(p.dagilim || []).length} dağılım</div>
                                                </td>
                                                <td className="c"><span className="pill info">{p.plateCount}</span></td>
                                                <td className="r muted mono">{fmt(p.purch, true)}</td>
                                                <td className="r mono fw500">{fmt(p.salesTotal, true)}</td>
                                                <td className="r mono">
                                                    <span style={{ color: p.profit >= 0 ? "#27500A" : "#791F1F", fontWeight: 500 }}>
                                                        {p.profit >= 0 ? "+" : ""}{fmt(p.profit, true)}
                                                    </span>
                                                </td>
                                                <td className="r"><span className={`pill ${profR >= 0 ? "pos" : "neg"}`}>{pctLabel(profR)}</span></td>
                                            </tr>
                                            {isOpen && (
                                                <ExpandRow
                                                    project={p}
                                                    projeDagilimRows={projeDagilimRows}
                                                    onPlateClick={setSelPlate}
                                                    selectedMonth={selectedMonth}
                                                />
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="tfoot-lbl">Genel toplam</td>
                                <td className="r mono muted">{fmt(totals.p, true)}</td>
                                <td className="r mono fw500">{fmt(totals.s, true)}</td>
                                <td className="r mono">
                                    <span style={{ color: totalProfit >= 0 ? "#27500A" : "#791F1F", fontWeight: 500 }}>
                                        {totalProfit >= 0 ? "+" : ""}{fmt(totalProfit, true)}
                                    </span>
                                </td>
                                <td className="r"><span className={`pill ${totalProfR >= 0 ? "pos" : "neg"}`}>{pctLabel(totalProfR)}</span></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}