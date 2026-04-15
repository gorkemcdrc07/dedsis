import React, { useMemo } from "react";
import "./PlakaDetayPenceresi.css";
import { fmt } from "./helpers";
import { PBadge } from "./ui";

function StatCard({ label, value, className = "" }) {
    return (
        <div className="dp-stat">
            <div className="dp-sl">{label}</div>
            <div className={`dp-sv ${className}`}>{value}</div>
        </div>
    );
}

function MiniSummaryTable({ title, rows, emptyText = "Veri yok" }) {
    return (
        <div className="mini-card">
            <div className="mini-card-head">
                <div className="sec-lbl">{title}</div>
            </div>

            <div className="mini-tbl">
                <div className="mini-tbl-body">
                    <table>
                        <thead>
                            <tr>
                                <th>ADI</th>
                                <th className="r">ALIŞ</th>
                                <th className="r">SATIŞ</th>
                                <th className="r">KAR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div className="empty">{emptyText}</div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((item) => (
                                    <tr key={item.name}>
                                        <td className="truncate-cell strong-cell" title={item.name}>
                                            {item.name}
                                        </td>
                                        <td className="r">{fmt(item.p, true)}</td>
                                        <td className="r">{fmt(item.s, true)}</td>
                                        <td className="r">
                                            <PBadge value={item.profit} />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function PlateDetailPanel({ plateNumber, allRows, onClose }) {
    const rows = useMemo(
        () => allRows.filter((r) => r.PlateNumber === plateNumber),
        [allRows, plateNumber]
    );

    const bySvc = useMemo(() => {
        const map = new Map();

        rows.forEach((r) => {
            const key = r.ServiceExpenseName || "-";
            if (!map.has(key)) map.set(key, { name: key, p: 0, s: 0, items: [] });

            const g = map.get(key);
            g.p += r.PurchaseInvoiceIncome || 0;
            g.s += r.SalesInvoceIncome || 0;
            g.items.push(r);
        });

        return [...map.values()]
            .map((x) => ({ ...x, profit: x.s - x.p }))
            .sort((a, b) => b.profit - a.profit);
    }, [rows]);

    const byProj = useMemo(() => {
        const map = new Map();

        rows.forEach((r) => {
            const key = r.ProjectName || "PROJESİZ";
            if (!map.has(key)) map.set(key, { name: key, p: 0, s: 0 });

            const g = map.get(key);
            g.p += r.PurchaseInvoiceIncome || 0;
            g.s += r.SalesInvoceIncome || 0;
        });

        return [...map.values()]
            .map((x) => ({ ...x, profit: x.s - x.p }))
            .sort((a, b) => b.profit - a.profit);
    }, [rows]);

    const total = useMemo(
        () =>
            rows.reduce(
                (a, r) => ({
                    p: a.p + (r.PurchaseInvoiceIncome || 0),
                    s: a.s + (r.SalesInvoceIncome || 0),
                }),
                { p: 0, s: 0 }
            ),
        [rows]
    );

    const totalProfit = total.s - total.p;

    return (
        <div className="dp modal">
            <div className="dp-head">
                <div className="dp-head-left">
                    <div className="dp-kicker">Plaka Detayı</div>
                    <div className="dp-title-row">
                        <div className="dp-title">{plateNumber}</div>
                        <div className={`dp-profit-pill ${totalProfit >= 0 ? "pos" : "neg"}`}>
                            {totalProfit >= 0 ? "Pozitif" : "Negatif"} Bakiye
                        </div>
                    </div>
                    <div className="dp-meta">
                        <span>{rows.length} kayıt</span>
                        <span>•</span>
                        <span>{byProj.length} proje</span>
                        <span>•</span>
                        <span>{bySvc.length} hizmet türü</span>
                    </div>
                </div>

                <button className="dp-close" onClick={onClose} aria-label="Kapat">
                    ✕
                </button>
            </div>

            <div className="dp-stats">
                <StatCard label="Toplam Alış" value={fmt(total.p, true)} />
                <StatCard label="Toplam Satış" value={fmt(total.s, true)} />
                <StatCard
                    label="Kar / Zarar"
                    value={fmt(totalProfit, true)}
                    className={totalProfit >= 0 ? "c-g" : "c-r"}
                />
                <StatCard label="Toplam İşlem" value={rows.length} />
            </div>

            <div className="dp-body">
                <div className="dp-top-grid">
                    <MiniSummaryTable title="Hizmet Bazlı Özet" rows={bySvc} />
                    <MiniSummaryTable title="Proje Bazlı Özet" rows={byProj} />
                </div>

                <div className="card details-card">
                    <div className="card-head">
                        <div>
                            <div className="card-title">Yapılan İşlemler</div>
                            <div className="card-sub">Bu plakaya ait detay kayıtlar</div>
                        </div>
                    </div>

                    <div className="tbl-wrap">
                        <table className="detail-table">
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
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="empty">Kayıt yok</div>
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((r) => {
                                        const profit =
                                            (r.SalesInvoceIncome || 0) - (r.PurchaseInvoiceIncome || 0);

                                        return (
                                            <tr key={r.id}>
                                                <td className="date-cell">
                                                    {r.TMSDespatchesDespatchDate
                                                        ? new Date(
                                                            r.TMSDespatchesDespatchDate
                                                        ).toLocaleDateString("tr-TR")
                                                        : "-"}
                                                </td>
                                                <td className="truncate-cell strong-cell" title={r.ProjectName || "-"}>
                                                    {r.ProjectName || "-"}
                                                </td>
                                                <td className="truncate-cell" title={r.ServiceExpenseName || "-"}>
                                                    {r.ServiceExpenseName || "-"}
                                                </td>
                                                <td className="truncate-cell" title={r.SupplierName || "-"}>
                                                    {r.SupplierName || "-"}
                                                </td>
                                                <td className="r amount-cell">
                                                    {fmt(r.PurchaseInvoiceIncome || 0, true)}
                                                </td>
                                                <td className="r amount-cell">
                                                    {fmt(r.SalesInvoceIncome || 0, true)}
                                                </td>
                                                <td className="r profit-cell">
                                                    <PBadge value={profit} />
                                                </td>
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

export default function PlateDetailModal({ plateNumber, allRows, onClose }) {
    if (!plateNumber) return null;

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="dp-shell" onClick={(e) => e.stopPropagation()}>
                <PlateDetailPanel
                    plateNumber={plateNumber}
                    allRows={allRows}
                    onClose={onClose}
                />
            </div>
        </div>
    );
}