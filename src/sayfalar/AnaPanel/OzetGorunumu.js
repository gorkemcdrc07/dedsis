import React, { useMemo } from "react";
import "./OzetGorunumu.css";
import { fmt, aggregatePlateSummary, aggregateServiceSummary } from "./helpers";
import { MiniBar } from "./ui";

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

function StatCard({ label, value, tone = "default" }) {
    return (
        <div className={`ov-stat ov-stat--${tone}`}>
            <div className="ov-stat__shine" />
            <div className="ov-stat__label">{label}</div>
            <div className="ov-stat__value">{value}</div>
        </div>
    );
}

function InsightCard({ title, sub, items, emptyText, max, color, negativeOnly = false, valueKey = "profit", nameKey = "name" }) {
    return (
        <section className="ov-panel">
            <div className="ov-panel__head">
                <div>
                    <div className="ov-panel__title">{title}</div>
                    <div className="ov-panel__sub">{sub}</div>
                </div>
            </div>

            <div className="ov-panel__body">
                {items.length === 0 ? (
                    <div className="ov-empty">{emptyText}</div>
                ) : (
                    items.map((item, idx) => {
                        const val = item[valueKey] || 0;
                        const name = item[nameKey] || "-";
                        return (
                            <div className="ov-list-item" key={`${name}-${idx}`}>
                                <div className="ov-list-item__top">
                                    <div className="ov-list-item__name" title={name}>
                                        {name}
                                    </div>
                                    <div
                                        className={`ov-list-item__value ${val >= 0 && !negativeOnly ? "is-pos" : "is-neg"
                                            }`}
                                    >
                                        {fmt(val, true)}
                                    </div>
                                </div>

                                <div className="ov-list-item__bar">
                                    <MiniBar value={val} max={max} color={color} />
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}

export default function OzetGorunumu({ projects = [], rows = [] }) {
    const safeProjects = Array.isArray(projects) ? projects : [];
    const safeRows = Array.isArray(rows) ? rows : [];

    const allowedProjectSet = useMemo(() => new Set(ALLOWED_PROJECTS), []);

    const filteredProjects = useMemo(() => {
        return safeProjects.filter((p) => allowedProjectSet.has(p.projectName));
    }, [safeProjects, allowedProjectSet]);

    const filteredRows = useMemo(() => {
        return safeRows.filter((r) => allowedProjectSet.has(r.ProjectName));
    }, [safeRows, allowedProjectSet]);

    const topProfit = useMemo(() => {
        return [...filteredProjects]
            .sort((a, b) => (b.profit || 0) - (a.profit || 0))
            .slice(0, 8);
    }, [filteredProjects]);

    const lossProjects = useMemo(() => {
        return filteredProjects
            .filter((p) => (p.profit || 0) < 0)
            .sort((a, b) => (a.profit || 0) - (b.profit || 0))
            .slice(0, 8);
    }, [filteredProjects]);

    const topSvc = useMemo(() => {
        return aggregateServiceSummary(filteredRows)
            .sort((a, b) => (b.profit || 0) - (a.profit || 0))
            .slice(0, 7);
    }, [filteredRows]);

    const topPlates = useMemo(() => {
        return aggregatePlateSummary(filteredRows)
            .sort((a, b) => (b.profit || 0) - (a.profit || 0))
            .slice(0, 7);
    }, [filteredRows]);

    const maxProfit = useMemo(
        () => Math.max(...topProfit.map((x) => Math.abs(x.profit || 0)), 1),
        [topProfit]
    );

    const maxLoss = useMemo(
        () => Math.max(...lossProjects.map((x) => Math.abs(x.profit || 0)), 1),
        [lossProjects]
    );

    const maxSvc = useMemo(
        () => Math.max(...topSvc.map((x) => Math.abs(x.profit || 0)), 1),
        [topSvc]
    );

    const maxPlate = useMemo(
        () => Math.max(...topPlates.map((x) => Math.abs(x.profit || 0)), 1),
        [topPlates]
    );

    const profitableCount = filteredProjects.filter((p) => (p.profit || 0) > 0).length;
    const lossCount = filteredProjects.filter((p) => (p.profit || 0) < 0).length;
    const serviceCount = new Set(
        filteredRows.map((r) => r.ServiceExpenseName).filter(Boolean)
    ).size;
    const totalRecordCount = filteredRows.length;

    return (
        <div className="ov-wrap">
            <div className="ov-hero">
                <div className="ov-hero__content">
                    <div className="ov-hero__kicker">Operasyon Özeti</div>
                    <h2 className="ov-hero__title">Daha net, daha modern genel görünüm</h2>
                    <p className="ov-hero__desc">
                        Sadece tanımlı proje listesi gösteriliyor. Karlılık, zarar, hizmet etkisi
                        ve plaka katkısı tek ekranda sade biçimde sunuluyor.
                    </p>
                </div>

                <div className="ov-hero__badge">
                    <span className="ov-hero__badge-label">Filtreli Proje</span>
                    <span className="ov-hero__badge-value">{ALLOWED_PROJECTS.length}</span>
                </div>
            </div>

            <div className="ov-stat-grid">
                <StatCard label="Kârlı Proje" value={profitableCount} tone="green" />
                <StatCard label="Zararlı Proje" value={lossCount} tone="red" />
                <StatCard label="Hizmet Türü" value={serviceCount} tone="blue" />
                <StatCard label="Toplam Kayıt" value={totalRecordCount} tone="amber" />
            </div>

            <div className="ov-grid">
                <InsightCard
                    title="En Karlı Projeler"
                    sub="Kârlılığa göre öne çıkan ilk 8 proje"
                    items={topProfit.map((x) => ({
                        ...x,
                        name: x.projectName,
                    }))}
                    emptyText="Gösterilecek proje bulunamadı."
                    max={maxProfit}
                    color="#2563eb"
                    nameKey="name"
                />

                <InsightCard
                    title="Zarar Eden Projeler"
                    sub={
                        lossProjects.length === 0
                            ? "Bu aralıkta zarar eden proje yok"
                            : `${lossProjects.length} proje negatif bölgede`
                    }
                    items={lossProjects.map((x) => ({
                        ...x,
                        name: x.projectName,
                    }))}
                    emptyText="Tüm filtreli projeler pozitif görünüyor."
                    max={maxLoss}
                    color="#dc2626"
                    negativeOnly
                    nameKey="name"
                />

                <InsightCard
                    title="Hizmet / Masraf Etkisi"
                    sub="Karlılığa en çok etki eden hizmetler"
                    items={topSvc}
                    emptyText="Gösterilecek hizmet verisi yok."
                    max={maxSvc}
                    color="#7c3aed"
                    nameKey="name"
                />

                <InsightCard
                    title="Plaka Katkısı"
                    sub="Karlılık açısından öne çıkan plakalar"
                    items={topPlates.map((x) => ({
                        ...x,
                        name: x.plate,
                    }))}
                    emptyText="Gösterilecek plaka verisi yok."
                    max={maxPlate}
                    color="#d97706"
                    nameKey="name"
                />
            </div>
        </div>
    );
}