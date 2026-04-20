import React, { useEffect, useMemo, useState } from "react";
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

function getSourceTableName(row) {
    const kaynak = String(row?.kaynak_tablo || "").toLowerCase().trim();

    if (kaynak === "ik") return "ik";
    if (kaynak === "muhasebe") return "muhasebe";

    return null;
}

export default function AnaPanelSayfasi() {
    const [startDate, setStartDate] = useState("2026-03-01");
    const [endDate, setEndDate] = useState("2026-03-31");

    const [rows, setRows] = useState([]);
    const [projectMasters, setProjectMasters] = useState([]);
    const [projeDagilimRows, setProjeDagilimRows] = useState([]);
    const [muhasebeRows, setMuhasebeRows] = useState([]);
    const [ikRows, setIkRows] = useState([]);

    const [loading, setLoading] = useState(false);
    const [savingDagilim, setSavingDagilim] = useState(false);
    const [error, setError] = useState("");
    const [tab, setTab] = useState("overview");
    const [tableView] = useState(1);
    const [elapsed, setElapsed] = useState(0);



    const selectedMonth = useMemo(() => {
        if (!startDate) return "";
        return String(new Date(startDate).getMonth() + 1).padStart(2, "0");
    }, [startDate]);

    useEffect(() => {
        let intervalId;

        if (loading) {
            intervalId = setInterval(() => {
                setElapsed((prev) => prev + 1);
            }, 1000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [loading]);

    const fetchAllPages = async (payload) => {
        let currentPage = 1;
        let totalPages = 1;
        let allItems = [];

        while (currentPage <= totalPages) {
            const resp = await fetch("https://dedsis.onrender.com/api/get-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...payload,
                    page: currentPage,
                }),
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(
                    errData?.detail
                        ? `API Hatası: ${JSON.stringify(errData.detail)}`
                        : errData?.message || `API Hatası: HTTP ${resp.status}`
                );
            }

            const result = await resp.json();

            const items = Array.isArray(result?.items) ? result.items : [];
            const pagination = result?.pagination || {};

            allItems = allItems.concat(items);
            totalPages = Number(pagination.totalPages || 1);

            currentPage += 1;
        }

        return allItems;
    };

    const fetchData = async () => {
        if (loading) return;

        setLoading(true);
        setError("");
        setElapsed(0);

        try {
            const payload = {
                startDate: `${startDate}T00:00:00`,
                endDate: `${endDate}T23:59:59`,
                userId: 1,
            };

            const [
                apiItems,
                { data: projelerData, error: projelerError },
                { data: projeDagilimData, error: projeDagilimError },
                { data: muhasebeData, error: muhasebeError },
                { data: ikData, error: ikError },
            ] = await Promise.all([
                fetchAllPages(payload),

                supabase
                    .from("projeler")
                    .select("id, proje_adi, reel_proje_adi")
                    .order("proje_adi"),

                supabase
                    .from("proje_dagilim_yeni")
                    .select(
                        "kaynak_tablo, kayit_id, kullanici_id, kullanici_adi, proje_id, proje_adi, reel_proje_adi, donem_yil, donem_ay, hesap_adi, alt_kalem, tutar, dagilim_orani, asil_tutar"
                    )
                    .eq("donem_ay", Number(selectedMonth)),

                supabase
                    .from("muhasebe")
                    .select("*")
                    .eq("donem_ayi", selectedMonth),

                supabase
                    .from("ik")
                    .select("*")
                    .eq("donem_yil", new Date(startDate).getFullYear())
                    .eq("donem_ayi", selectedMonth),
            ]);

            console.log("startDate", startDate);
            console.log("selectedMonth", selectedMonth);
            console.log("muhasebeData", muhasebeData);
            console.log("ikData", ikData);
            console.log("muhasebeError", muhasebeError);
            console.log("ikError", ikError);
            console.log("projeDagilimData ilk 20", (projeDagilimData || []).slice(0, 20));

            if (projelerError || projeDagilimError || muhasebeError || ikError) {
                throw new Error(
                    projelerError?.message ||
                    projeDagilimError?.message ||
                    muhasebeError?.message ||
                    ikError?.message ||
                    "Veritabanı verileri alınamadı."
                );
            }

            const normalized = normalizeRows(Array.isArray(apiItems) ? apiItems : []);

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

        const visibleProjectIds = new Set(
            projects
                .map((p) => Number(p.projeMaster?.id))
                .filter((id) => Number.isFinite(id))
        );

        const dagitimPurchase = projeDagilimRows.reduce((sum, row) => {
            const projeId = Number(row.proje_id);
            if (!visibleProjectIds.has(projeId)) return sum;
            return sum + Number(row.tutar || 0);
        }, 0);

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
    }, [rows, projeDagilimRows, muhasebeRows, ikRows, projects]);

    const handleDagilimRowsChange = async (updatedRows, meta) => {
        const previousDagilimRows = projeDagilimRows;
        const previousIkRows = ikRows;
        const previousMuhasebeRows = muhasebeRows;

        try {
            setSavingDagilim(true);
            setError("");

            setProjeDagilimRows(updatedRows);
            console.log("Dağılım güncellendi:", meta);

            if (!meta?.type) return;

            if (meta.type === "move") {
                const sourceRows = meta.item?.sourceRows || [];

                for (const row of sourceRows) {
                    const tableName = getSourceTableName(row);
                    if (!tableName) continue;

                    const { error: moveError } = await supabase
                        .from(tableName)
                        .update({
                            proje_id: Number(meta.targetProjectId),
                        })
                        .eq("id", row.kayit_id || row.id);

                    if (moveError) throw moveError;
                }

                setIkRows((prev) =>
                    prev.map((row) => {
                        const matched = sourceRows.find(
                            (s) =>
                                String(s.kaynak_tablo).toLowerCase() === "ik" &&
                                String(s.kayit_id || s.id) === String(row.id)
                        );

                        if (!matched) return row;

                        return {
                            ...row,
                            proje_id: Number(meta.targetProjectId),
                        };
                    })
                );

                setMuhasebeRows((prev) =>
                    prev.map((row) => {
                        const matched = sourceRows.find(
                            (s) =>
                                String(s.kaynak_tablo).toLowerCase() === "muhasebe" &&
                                String(s.kayit_id || s.id) === String(row.id)
                        );

                        if (!matched) return row;

                        return {
                            ...row,
                            proje_id: Number(meta.targetProjectId),
                        };
                    })
                );
            }

            if (meta.type === "delete") {
                const deletedRows = meta.deletedRows || [];

                for (const row of deletedRows) {
                    const tableName = getSourceTableName(row);
                    if (!tableName) continue;

                    const { error: deleteError } = await supabase
                        .from(tableName)
                        .delete()
                        .eq("id", row.kayit_id || row.id);

                    if (deleteError) throw deleteError;
                }

                setIkRows((prev) =>
                    prev.filter(
                        (row) =>
                            !deletedRows.some(
                                (d) =>
                                    String(d.kaynak_tablo).toLowerCase() === "ik" &&
                                    String(d.kayit_id || d.id) === String(row.id)
                            )
                    )
                );

                setMuhasebeRows((prev) =>
                    prev.filter(
                        (row) =>
                            !deletedRows.some(
                                (d) =>
                                    String(d.kaynak_tablo).toLowerCase() === "muhasebe" &&
                                    String(d.kayit_id || d.id) === String(row.id)
                            )
                    )
                );
            }

            if (meta.type === "edit") {
                const sourceRows = meta.item?.sourceRows || [];
                const oldTotal = sourceRows.reduce(
                    (sum, r) => sum + Number(r.tutar || 0),
                    0
                );
                const newTotal = Number(meta.form?.tutar || 0);
                const ratio = oldTotal > 0 ? newTotal / oldTotal : 1;

                for (const row of sourceRows) {
                    const tableName = getSourceTableName(row);
                    if (!tableName) continue;

                    const yeniTutar = Number(row.tutar || 0) * ratio;

                    if (tableName === "ik") {
                        const { error: editError } = await supabase
                            .from("ik")
                            .update({
                                tutar: yeniTutar,
                            })
                            .eq("id", row.kayit_id || row.id);

                        if (editError) throw editError;
                    }

                    if (tableName === "muhasebe") {
                        const { error: editError } = await supabase
                            .from("muhasebe")
                            .update({
                                hesap_adi: meta.form?.hesap_adi || "",
                                tutar: yeniTutar,
                            })
                            .eq("id", row.kayit_id || row.id);

                        if (editError) throw editError;
                    }
                }

                setIkRows((prev) =>
                    prev.map((row) => {
                        const matched = sourceRows.find(
                            (s) =>
                                String(s.kaynak_tablo).toLowerCase() === "ik" &&
                                String(s.kayit_id || s.id) === String(row.id)
                        );

                        if (!matched) return row;

                        return {
                            ...row,
                            tutar: Number(matched.tutar || 0) * ratio,
                        };
                    })
                );

                setMuhasebeRows((prev) =>
                    prev.map((row) => {
                        const matched = sourceRows.find(
                            (s) =>
                                String(s.kaynak_tablo).toLowerCase() === "muhasebe" &&
                                String(s.kayit_id || s.id) === String(row.id)
                        );

                        if (!matched) return row;

                        return {
                            ...row,
                            hesap_adi: meta.form?.hesap_adi || row.hesap_adi,
                            tutar: Number(matched.tutar || 0) * ratio,
                        };
                    })
                );
            }
        } catch (err) {
            console.error("Dağılım kayıt hatası:", err);
            setProjeDagilimRows(previousDagilimRows);
            setIkRows(previousIkRows);
            setMuhasebeRows(previousMuhasebeRows);
            setError(err.message || "Dağılım değişikliği kaydedilemedi.");
        } finally {
            setSavingDagilim(false);
        }
    };

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
                        disabled={loading || savingDagilim}
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
                            <div>{elapsed} saniyedir yükleniyor...</div>
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
                                            onDagilimRowsChange={handleDagilimRowsChange}
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