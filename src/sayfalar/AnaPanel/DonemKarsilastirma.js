import React, { useMemo, useState } from "react";
import "./DonemKarsilastirma.css";
import { normalizeRows, aggregateByProject, fmt, norm } from "./helpers";

export const ALLOWED_PROJECTS = [
    "KEMERBURGAZ MNG DEDİKE",
    "MNG BAKIRKÖY DEDİKE",
    "MNG TRAKYA DEDİKE",
    "MNG TRAKYA FTL",
    "MNG BURSA DEDİKE",
    "MNG İZMİR DEDİKE",
    "MNG ADANA FTL",
    "EVİDEA DEDİKE",
    "BİOTA DEDİKE FTL",
    "ES GLOBAL DEDİKE",
    "BAŞBUĞ FTL",
    "BAŞBUĞ ŞEKERPINAR DEDİKE",
    "BAŞBUĞ BURSA DEDİKE",
    "KALE KİLİT DEDİKE FTL",
    "MNG ASYA",
    "MNG GEBZE DEDİKE RİNG",
    "MNG MARMARA DEDİKE",
];

const MONTHS_TR = [
    "Ocak",
    "Şubat",
    "Mart",
    "Nisan",
    "Mayıs",
    "Haziran",
    "Temmuz",
    "Ağustos",
    "Eylül",
    "Ekim",
    "Kasım",
    "Aralık",
];

function monthLabel(start, end) {
    if (!start) return "—";

    const s = new Date(start);
    const e = new Date(end || start);

    const sm = s.getMonth();
    const em = e.getMonth();
    const sy = s.getFullYear();
    const ey = e.getFullYear();

    if (sy === ey && sm === em) return `${MONTHS_TR[sm]} ${sy}`;
    if (sy === ey) return `${MONTHS_TR[sm]} ${sy} ↔ ${MONTHS_TR[em]} ${sy}`;
    return `${MONTHS_TR[sm]} ${sy} ↔ ${MONTHS_TR[em]} ${ey}`;
}

function fmtCurrency(v) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.round(Number(v) || 0));
}

function deltaText(a, b, isMoney = true) {
    const d = Number(b || 0) - Number(a || 0);
    const prefix = d >= 0 ? "+" : "";

    if (isMoney) return `${prefix}${fmtCurrency(d)}`;
    return `${prefix}${Math.round(d).toLocaleString("tr-TR")}`;
}

function deltaClass(a, b) {
    return Number(b || 0) - Number(a || 0) >= 0 ? "dk-is-pos" : "dk-is-neg";
}

function StatCard({ title, aLabel, aValue, bLabel, bValue, delta, deltaType }) {
    return (
        <div className="dk-stat-card">
            <div className="dk-stat-title">{title}</div>

            <div className="dk-stat-rows">
                <div className="dk-stat-row">
                    <span className="dk-stat-label">{aLabel}</span>
                    <strong className="dk-stat-value">{aValue}</strong>
                </div>

                <div className="dk-stat-row">
                    <span className="dk-stat-label">{bLabel}</span>
                    <strong className="dk-stat-value">{bValue}</strong>
                </div>
            </div>

            <div className={`dk-delta ${deltaType}`}>{delta}</div>
        </div>
    );
}

export default function DonemKarsilastirma({ projeDagilimRows = [] }) {
    const [pA, setPA] = useState({ start: "2026-02-01", end: "2026-02-28" });
    const [pB, setPB] = useState({ start: "2026-03-01", end: "2026-03-31" });

    const [dA, setDA] = useState(null);
    const [dB, setDB] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const allowedProjectSet = useMemo(() => new Set(ALLOWED_PROJECTS), []);

    const isRowInPeriod = (row, period) => {
        if (!row) return false;

        const rawDate =
            row.tarih ||
            row.Tarih ||
            row.date ||
            row.Date ||
            row.created_at ||
            row.CreatedAt;

        if (!rawDate) return true;

        const rowDate = new Date(rawDate);
        const start = new Date(`${period.start}T00:00:00`);
        const end = new Date(`${period.end}T23:59:59`);

        if (Number.isNaN(rowDate.getTime())) return true;

        return rowDate >= start && rowDate <= end;
    };

    const getDagilimForPeriod = (period) => {
        if (!Array.isArray(projeDagilimRows)) return [];
        return projeDagilimRows.filter((row) => isRowInPeriod(row, period));
    };

    const fetchPeriod = async (period) => {
        const resp = await fetch("http://localhost:5000/api/get-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                startDate: `${period.start}T00:00:00`,
                endDate: `${period.end}T23:59:59`,
                userId: 1,
            }),
        });

        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }

        const result = await resp.json();
        const normalizedRows = normalizeRows(Array.isArray(result) ? result : []);

        const rows = normalizedRows.filter((r) => allowedProjectSet.has(r.ProjectName));

        const rawProjects = aggregateByProject(rows).filter((p) =>
            allowedProjectSet.has(p.projectName || p.key)
        );

        const periodDagilimRows = getDagilimForPeriod(period);

        const allProjectNames = new Set([
            ...rawProjects.map((p) => p.projectName || p.key),
            ...periodDagilimRows
                .map((row) => row.reel_proje_adi)
                .filter(Boolean)
                .filter((name) => allowedProjectSet.has(name)),
        ]);

        const enrichedProjects = [...allProjectNames].map((projectName) => {
            const project =
                rawProjects.find((p) => norm(p.projectName || p.key) === norm(projectName)) || {};

            const projectDagilim = periodDagilimRows.filter(
                (row) => norm(row.reel_proje_adi) === norm(projectName)
            );

            const dagitimToplamAlis = projectDagilim.reduce(
                (sum, row) => sum + Number(row.dagitilan_tutar || 0),
                0
            );

            const purchaseTotal = Number(project.purchaseTotal || 0);
            const salesTotal = Number(project.salesTotal || 0);
            const purchaseTotalWithDagilim = purchaseTotal + dagitimToplamAlis;
            const profitWithDagilim = salesTotal - purchaseTotalWithDagilim;

            return {
                ...project,
                projectName,
                dagitimToplamAlis,
                purchaseTotal,
                purchaseTotalWithDagilim,
                salesTotal,
                profitWithDagilim,
            };
        });

        const plates = new Set(rows.map((r) => r.PlateNumber).filter(Boolean));

        const purchase = enrichedProjects.reduce(
            (sum, p) => sum + Number(p.purchaseTotalWithDagilim || 0),
            0
        );

        const sales = enrichedProjects.reduce(
            (sum, p) => sum + Number(p.salesTotal || 0),
            0
        );

        return {
            rows,
            projs: enrichedProjects,
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
            const [a, b] = await Promise.all([fetchPeriod(pA), fetchPeriod(pB)]);
            setDA(a);
            setDB(b);
        } catch (err) {
            setError(err.message || "Karşılaştırma alınamadı.");
        } finally {
            setLoading(false);
        }
    };

    const labelA = monthLabel(pA.start, pA.end);
    const labelB = monthLabel(pB.start, pB.end);

    const projCmp = useMemo(() => {
        if (!dA || !dB) return [];

        const mA = new Map(
            dA.projs
                .filter((p) => allowedProjectSet.has(p.projectName || p.key))
                .map((p) => [p.projectName || p.key, p])
        );

        const mB = new Map(
            dB.projs
                .filter((p) => allowedProjectSet.has(p.projectName || p.key))
                .map((p) => [p.projectName || p.key, p])
        );

        const keys = new Set([...mA.keys(), ...mB.keys()]);

        return [...keys]
            .map((k) => {
                const aProj = mA.get(k);
                const bProj = mB.get(k);

                return {
                    name: k,
                    aPurchase: Number(aProj?.purchaseTotalWithDagilim || 0),
                    aProfit: Number(aProj?.profitWithDagilim || 0),
                    bPurchase: Number(bProj?.purchaseTotalWithDagilim || 0),
                    bProfit: Number(bProj?.profitWithDagilim || 0),
                };
            })
            .filter((x) => allowedProjectSet.has(x.name))
            .sort(
                (a, b) =>
                    Math.abs(b.bProfit - b.aProfit) - Math.abs(a.bProfit - a.aProfit)
            );
    }, [dA, dB, allowedProjectSet]);

    const hasData = dA && dB && !loading;

    return (
        <div className="dk-wrap">
            <div className="dk-card">
                <div className="dk-toolbar">
                    <div className="dk-toolbar-title">Dönem Karşılaştırma</div>

                    <div className="dk-inputs">
                        <div className="dk-period-box">
                            <div className="dk-period-title">Dönem A</div>
                            <div className="dk-period-label">{labelA}</div>
                            <div className="dk-date-row">
                                <input
                                    type="date"
                                    className="dk-input"
                                    value={pA.start}
                                    onChange={(e) =>
                                        setPA((prev) => ({ ...prev, start: e.target.value }))
                                    }
                                />
                                <span className="dk-sep">—</span>
                                <input
                                    type="date"
                                    className="dk-input"
                                    value={pA.end}
                                    onChange={(e) =>
                                        setPA((prev) => ({ ...prev, end: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <div className="dk-period-box">
                            <div className="dk-period-title">Dönem B</div>
                            <div className="dk-period-label">{labelB}</div>
                            <div className="dk-date-row">
                                <input
                                    type="date"
                                    className="dk-input"
                                    value={pB.start}
                                    onChange={(e) =>
                                        setPB((prev) => ({ ...prev, start: e.target.value }))
                                    }
                                />
                                <span className="dk-sep">—</span>
                                <input
                                    type="date"
                                    className="dk-input"
                                    value={pB.end}
                                    onChange={(e) =>
                                        setPB((prev) => ({ ...prev, end: e.target.value }))
                                    }
                                />
                            </div>
                        </div>

                        <button className="dk-button" onClick={compare} disabled={loading}>
                            {loading ? "Karşılaştırılıyor..." : "Karşılaştır"}
                        </button>
                    </div>
                </div>

                {error ? <div className="dk-error">{error}</div> : null}

                {!dA && !dB && !loading && (
                    <div className="dk-empty">
                        İki dönem seçip karşılaştırma başlatın.
                    </div>
                )}

                {loading && (
                    <div className="dk-loading">
                        <div className="dk-spinner" />
                        <div>Veriler hazırlanıyor...</div>
                    </div>
                )}

                {hasData && (
                    <>
                        <div className="dk-stats-grid">
                            <StatCard
                                title="Toplam Alış"
                                aLabel={labelA}
                                aValue={fmt(dA.purchase, true)}
                                bLabel={labelB}
                                bValue={fmt(dB.purchase, true)}
                                delta={deltaText(dA.purchase, dB.purchase, true)}
                                deltaType={deltaClass(dA.purchase, dB.purchase)}
                            />

                            <StatCard
                                title="Toplam Satış"
                                aLabel={labelA}
                                aValue={fmt(dA.sales, true)}
                                bLabel={labelB}
                                bValue={fmt(dB.sales, true)}
                                delta={deltaText(dA.sales, dB.sales, true)}
                                deltaType={deltaClass(dA.sales, dB.sales)}
                            />

                            <StatCard
                                title="Net Kar"
                                aLabel={labelA}
                                aValue={fmt(dA.profit, true)}
                                bLabel={labelB}
                                bValue={fmt(dB.profit, true)}
                                delta={deltaText(dA.profit, dB.profit, true)}
                                deltaType={deltaClass(dA.profit, dB.profit)}
                            />

                            <StatCard
                                title="Plaka Sayısı"
                                aLabel={labelA}
                                aValue={dA.plateCount}
                                bLabel={labelB}
                                bValue={dB.plateCount}
                                delta={deltaText(dA.plateCount, dB.plateCount, false)}
                                deltaType={deltaClass(dA.plateCount, dB.plateCount)}
                            />
                        </div>

                        <div className="dk-table-card">
                            <div className="dk-table-head">
                                <div className="dk-table-title">Proje bazlı karşılaştırma</div>
                                <div className="dk-table-sub">
                                    {labelA} ↔ {labelB} — {projCmp.length} proje
                                </div>
                            </div>

                            <div className="dk-table-wrap">
                                <table className="dk-table">
                                    <colgroup>
                                        <col className="dk-col-project" />
                                        <col className="dk-col-money" />
                                        <col className="dk-col-money" />
                                        <col className="dk-col-money" />
                                        <col className="dk-col-money" />
                                        <col className="dk-col-diff" />
                                    </colgroup>

                                    <thead>
                                        <tr>
                                            <th>PROJE</th>
                                            <th className="dk-right">{labelA} ALIŞ</th>
                                            <th className="dk-right">{labelB} ALIŞ</th>
                                            <th className="dk-right">{labelA} KAR</th>
                                            <th className="dk-right">{labelB} KAR</th>
                                            <th className="dk-right">FARK</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {projCmp.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="dk-table-empty">
                                                    Karşılaştırılacak proje verisi yok.
                                                </td>
                                            </tr>
                                        ) : (
                                            projCmp.map((p) => {
                                                const diff = p.bProfit - p.aProfit;

                                                return (
                                                    <tr key={p.name}>
                                                        <td className="dk-project-name" title={p.name}>
                                                            {p.name}
                                                        </td>

                                                        <td className="dk-right dk-money-cell">
                                                            {fmtCurrency(p.aPurchase)}
                                                        </td>

                                                        <td className="dk-right dk-money-cell">
                                                            {fmtCurrency(p.bPurchase)}
                                                        </td>

                                                        <td className="dk-right dk-money-cell">
                                                            {fmtCurrency(p.aProfit)}
                                                        </td>

                                                        <td className="dk-right dk-money-cell">
                                                            {fmtCurrency(p.bProfit)}
                                                        </td>

                                                        <td className="dk-right dk-money-cell">
                                                            <span
                                                                className={`dk-badge ${diff >= 0
                                                                        ? "dk-badge-good"
                                                                        : "dk-badge-bad"
                                                                    }`}
                                                            >
                                                                {diff >= 0 ? "+" : ""}
                                                                {fmtCurrency(diff)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}