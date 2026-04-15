import React, { useMemo, useState } from "react";
import "./anaPanel.css";
import { supabase } from "../../lib/supabase";

import {
    normalizeRows,
    aggregateByProject,
    fmt,
    monthLabel,
    norm,
} from "./helpers";

import OzetGorunumu from "./OzetGorunumu";
import ProjeTablosu from "./ProjeTablosu";
import ProjeTablosu2 from "./ProjeTablosu2";
import DonemKarsilastirma from "./DonemKarsilastirma";
import YapayZekaAnalizi from "./YapayZekaAnalizi";

const TABS = [
    { key: "overview", label: "Özet Görünümü", icon: "📊" },
    { key: "projects", label: "Proje Tablosu", icon: "📁" },
    { key: "compare", label: "Dönem Karşılaştırma", icon: "🗓️" },
    { key: "ai", label: "Yapay Zeka Analizi", icon: "🤖" },
];

export default function AnaPanelSayfasi() {
    const [startDate, setStartDate] = useState("2026-03-01");
    const [endDate, setEndDate] = useState("2026-03-31");

    const [rows, setRows] = useState([]);
    const [projectMasters, setProjectMasters] = useState([]);
    const [projeDagilimRows, setProjeDagilimRows] = useState([]);
    const [muhasebeRows, setMuhasebeRows] = useState([]);
    const [ikRows, setIkRows] = useState([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("overview");
    const [tableView, setTableView] = useState(1);

    const selectedMonth = useMemo(() => {
        if (!startDate) return "";
        return String(new Date(startDate).getMonth() + 1).padStart(2, "0");
    }, [startDate]);

    const fetchData = async () => {
        setLoading(true);
        setError("");

        try {
            const [
                apiResp,
                { data: projelerData, error: projelerError },
                { data: projeDagilimData, error: projeDagilimError },
                { data: muhasebeData, error: muhasebeError },
                { data: ikData, error: ikError },
            ] = await Promise.all([
                fetch("http://localhost:5000/api/get-data", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        startDate: `${startDate}T00:00:00`,
                        endDate: `${endDate}T23:59:59`,
                        userId: 1,
                    }),
                }),

                supabase
                    .from("projeler")
                    .select("id, proje_adi, reel_proje_adi")
                    .order("proje_adi"),

                supabase
                    .from("proje_dagilim_yeni")
                    .select("kaynak_tablo, kayit_id, kullanici_id, kullanici_adi, proje_id, proje_adi, reel_proje_adi, donem_yil, donem_ay, hesap_adi, alt_kalem, tutar, dagilim_orani, asil_tutar")
                    .eq("donem_ay", Number(selectedMonth)), // ✅

                supabase
                    .from("muhasebe")
                    .select("*")
                    .eq("donem_ayi", selectedMonth),

                supabase
                    .from("ik")
                    .select("*")
                    .eq("donem_ayi", selectedMonth),
            ]);
            if (!apiResp.ok) {
                throw new Error(`API Hatası: HTTP ${apiResp.status}`);
            }

            if (projelerError || projeDagilimError || muhasebeError || ikError) {
                throw new Error(
                    projelerError?.message ||
                    projeDagilimError?.message ||
                    muhasebeError?.message ||
                    ikError?.message ||
                    "Veritabanı verileri alınamadı."
                );
            }

            const apiResult = await apiResp.json();
            const normalized = normalizeRows(Array.isArray(apiResult) ? apiResult : []);

            const allowedProjectSet = new Set(
                (projelerData || [])
                    .map((p) => norm(p.reel_proje_adi || p.proje_adi))
                    .filter(Boolean)
            );

            const filteredApiRows = normalized.filter((row) =>
                allowedProjectSet.has(norm(row.ProjectName))
            );

            setRows(filteredApiRows);
            setProjectMasters(projelerData || []);
            setProjeDagilimRows(projeDagilimData || []);
            setMuhasebeRows(muhasebeData || []);
            setIkRows(ikData || []);
        } catch (err) {
            setError(err.message || "Veriler alınamadı.");
            setRows([]);
            setProjectMasters([]);
            setProjeDagilimRows([]);
            setMuhasebeRows([]);
            setIkRows([]);
        } finally {
            setLoading(false);
        }
    };

    const projects = useMemo(() => {
        const apiProjects = aggregateByProject(rows);

        return apiProjects
            .map((project) => {
                const projeMaster = projectMasters.find(
                    (p) =>
                        norm(p.reel_proje_adi || p.proje_adi) ===
                        norm(project.projectName)
                );

                return {
                    ...project,
                    projeMaster,
                    key: project.projectName,
                };
            })
            .filter((project) => !!project.projeMaster);
    }, [rows, projectMasters]);

    const totals = useMemo(() => {
        const apiPurchase = rows.reduce(
            (a, r) => a + Number(r.PurchaseInvoiceIncome || 0),
            0
        );
        const apiSales = rows.reduce(
            (a, r) => a + Number(r.SalesInvoceIncome || 0),
            0
        );

        const dagitimPurchase = projeDagilimRows.reduce(
            (sum, row) => sum + Number(row.asil_tutar || 0),
            0
        );

        const purchase = apiPurchase + dagitimPurchase;
        const sales = apiSales;
        const profit = sales - purchase;
        const plateCount = new Set(rows.map((r) => r.PlateNumber || "-")).size;

        const toplamMuhasebe = muhasebeRows.reduce(
            (sum, item) => sum + Number(item.tutar || 0),
            0
        );

        const toplamIk = ikRows.reduce(
            (sum, item) => sum + Number(item.tutar || 0),
            0
        );

        const profitPercent = sales > 0 ? (profit / sales) * 100 : 0;

        return {
            apiPurchase,
            dagitimPurchase,
            purchase,
            sales,
            profit,
            profitPercent,
            plateCount,
            toplamMuhasebe,
            toplamIk,
            toplamMaliyet: toplamMuhasebe + toplamIk,
        };
    }, [rows, projeDagilimRows, muhasebeRows, ikRows]);
    return (
        <div className="app">
            <div className="topbar">
                <div className="brand">
                    Ana<em>Panel</em>
                </div>
                <div className="spacer" />

                <div className="date-group">
                    <span className="dlabel">Başlangıç</span>
                    <input
                        className="dinput"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />

                    <span className="dsep">—</span>

                    <span className="dlabel">Bitiş</span>
                    <input
                        className="dinput"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />

                    <button
                        className="btn-fetch"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        {loading ? "Yükleniyor..." : "Veri Getir"}
                    </button>
                </div>
            </div>

            {error ? <div className="err">{error}</div> : null}

            <div className="body">
                <div className="content">
                    <div className="stats-bar">
                        <div className="stat-cell">
                            <div className="stat-lbl">Dönem</div>
                            <div className="stat-val">
                                {monthLabel(startDate, endDate)}
                            </div>
                        </div>

                        <div className="stat-cell">
                            <div className="stat-lbl">Toplam Alış</div>
                            <div className="stat-val">
                                {fmt(totals.purchase, true)}
                            </div>
                        </div>

                        <div className="stat-cell">
                            <div className="stat-lbl">Toplam Satış</div>
                            <div className="stat-val">
                                {fmt(totals.sales, true)}
                            </div>
                        </div>

                        <div className="stat-cell">
                            <div className="stat-lbl">Net Kar / Zarar</div>
                            <div className={`stat-val ${totals.profit >= 0 ? "g" : "r"}`}>
                                {fmt(totals.profit, true)}
                            </div>
                            <div className={`stat-sub ${totals.profit >= 0 ? "g" : "r"}`}>
                                %{Math.abs(totals.profitPercent).toFixed(1)}
                            </div>
                        </div>
                    </div>

                    <div className="tabs">
                        {TABS.map((t) => (
                            <div
                                key={t.key}
                                className={`tab ${tab === t.key ? "active" : ""}`}
                                onClick={() => setTab(t.key)}
                            >
                                <span>{t.icon}</span>
                                <span>{t.label}</span>
                            </div>
                        ))}
                    </div>


                    {loading ? (
                        <div className="loading">
                            <div className="spin" />
                            <div>Veriler hazırlanıyor...</div>
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="no-data">
                            <div className="no-data-i">📭</div>
                            <div className="no-data-t">Henüz veri yok</div>
                            <div>
                                Tarih aralığı seçip “Veri Getir” butonuna bas.
                            </div>
                        </div>
                    ) : (
                        <>
                            {tab === "overview" && (
                                        <OzetGorunumu
                                            projects={projects}
                                            rows={rows}
                                            muhasebeRows={muhasebeRows}
                                            ikRows={ikRows}
                                            projeDagilimRows={projeDagilimRows}
                                            selectedMonth={selectedMonth}
                                        />
                                    )}

                            {tab === "projects" && (
                                <>
                                    {tableView === 1 ? (
                                                <ProjeTablosu
                                                    projects={projects}
                                                    allRows={rows}
                                                    projeDagilimRows={projeDagilimRows}
                                                    selectedMonth={selectedMonth}
                                                />
                                            ) : (
                                                    <ProjeTablosu2
                                                        projects={projects}
                                                        allRows={rows}
                                                        projeDagilimRows={projeDagilimRows}
                                                        selectedMonth={selectedMonth}
                                                />
                                            )}
                                </>
                            )}

                            {tab === "compare" && <DonemKarsilastirma />}

                            {tab === "ai" && (
                                        <YapayZekaAnalizi
                                            projects={projects}
                                            rows={rows}
                                            muhasebeRows={muhasebeRows}
                                            ikRows={ikRows}
                                            projeDagilimRows={projeDagilimRows}
                                            selectedMonth={selectedMonth}
                                        />
                                    )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}