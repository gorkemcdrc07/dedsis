

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./muhasebeKarlilik.css";
import { supabase } from "../../lib/supabase";
import {
    parseMuhasebeExcel,
    formatMoney,
    formatDateTR,
    uniqueValues,
} from "./muhasebeParsers";

/* ─── Helpers ─── */
function round2(v) {
    return Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
}

const MONTH_OPTIONS = [
    { value: "01", label: "Ocak" },
    { value: "02", label: "Şubat" },
    { value: "03", label: "Mart" },
    { value: "04", label: "Nisan" },
    { value: "05", label: "Mayıs" },
    { value: "06", label: "Haziran" },
    { value: "07", label: "Temmuz" },
    { value: "08", label: "Ağustos" },
    { value: "09", label: "Eylül" },
    { value: "10", label: "Ekim" },
    { value: "11", label: "Kasım" },
    { value: "12", label: "Aralık" },
];

const INIT_FILTERS = {
    search: "",
    hesapAdi: "",
    sorumlulukMerkezi: "",
    tarihBaslangic: "",
    tarihBitis: "",
};

/* ─── MoneyCell ─── */
function MoneyCell({ value }) {
    const n = Number(value || 0);
    return (
        <span className={`mk-money ${n > 0 ? "positive" : "zero"}`}>
            {formatMoney(n)}
        </span>
    );
}

/* ─── AlertModal ─── */
function AlertModal({ open, type = "info", title, message, onClose }) {
    if (!open) return null;
    const icons = { success: "✓", error: "✕", warning: "⚠", info: "i" };

    return (
        <div className="mk-overlay" onClick={onClose}>
            <div className="mk-modal" onClick={(e) => e.stopPropagation()}>
                <div className={`mk-modal-icon-box ${type}`}>{icons[type]}</div>
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="mk-modal-foot">
                    <button className="btn btn-primary" onClick={onClose}>
                        Tamam
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── SortableTH ─── */
function SortableTH({ sortConfig, onSort, keyName, label, className = "" }) {
    const active = sortConfig.key === keyName;
    const dir = active ? sortConfig.direction : "";

    return (
        <th
            className={`${active ? "active" : ""} ${className}`}
            onClick={() => onSort(keyName)}
        >
            <div className="mk-th-inner">
                <span>{label}</span>
                <span className={`mk-sort-icon ${active ? "active" : ""}`}>
                    {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
                </span>
            </div>
        </th>
    );
}

/* ─── TargetItem ─── */
function TargetItem({
    item,
    selected,
    percentage,
    onToggle,
    onPctChange,
    showPct,
    singleSelected,
}) {
    return (
        <div
            className={`mk-target-item ${selected ? "selected" : ""}`}
            onClick={onToggle}
        >
            <div className="mk-target-checkmark">{selected ? "✓" : ""}</div>
            <div className="mk-target-item-name">{item.label}</div>

            {showPct && selected && !singleSelected && (
                <div
                    className="mk-target-item-pct"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={percentage ?? ""}
                        onChange={(e) => onPctChange(item.id, e.target.value)}
                        placeholder="0"
                    />
                    <span>%</span>
                </div>
            )}

            {showPct && selected && singleSelected && (
                <span
                    style={{
                        fontSize: 12,
                        color: "var(--green)",
                        fontWeight: 700,
                    }}
                >
                    %100
                </span>
            )}
        </div>
    );
}

/* ─── Main Component ─── */
export default function MuhasebeKarlilikSayfasi() {
    const fileInputRef = useRef(null);

    /* Data state */
    const [rows, setRows] = useState([]);
    const [fileName, setFileName] = useState("");
    const [sheetName, setSheetName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [dragActive, setDragActive] = useState(false);

    /* Supabase data */
    const [projects, setProjects] = useState([]);

    /* Distribution config */
    const [selectedMonth, setSelectedMonth] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [percentages, setPercentages] = useState({});

    /* UI state */
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState(INIT_FILTERS);
    const [sortConfig, setSortConfig] = useState({
        key: "tarihObj",
        direction: "desc",
    });
    const [modal, setModal] = useState({
        open: false,
        type: "info",
        title: "",
        message: "",
    });

    /* ─── Load Supabase ─── */
    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        const { data } = await supabase
            .from("projeler")
            .select("id, proje_adi, reel_proje_adi")
            .order("reel_proje_adi");

        setProjects(data || []);
    };
    /* ─── Modal ─── */
    const showModal = useCallback((type, title, message) => {
        setModal({ open: true, type, title, message });
    }, []);

    /* ─── Target list (sadece projeler) ─── */
    const targetList = useMemo(() => {
        const seen = new Set();

        return projects.filter((p) => {
            const key = p.reel_proje_adi?.trim();

            if (!key || seen.has(key)) {
                return false; // daha önce gösterildi → gösterme
            }

            seen.add(key);
            return true;
        }).map((p) => ({
            id: p.id,
            label: p.reel_proje_adi,
        }));
    }, [projects]);    /* ─── Tümünü seç ─── */
    const handleSelectAllTargets = () => {
        const allIds = targetList.map((item) => item.id);
        setSelectedIds(allIds);

        if (allIds.length === 0) {
            setPercentages({});
            return;
        }

        if (allIds.length === 1) {
            setPercentages({ [allIds[0]]: 100 });
            return;
        }

        const each = round2(100 / allIds.length);
        const last = round2(100 - each * (allIds.length - 1));
        const np = {};

        allIds.forEach((id, i) => {
            np[id] = i === allIds.length - 1 ? last : each;
        });

        setPercentages(np);
    };

    const areAllTargetsSelected =
        targetList.length > 0 && selectedIds.length === targetList.length;

    /* ─── Toggle target ─── */
    const toggleTarget = (id) => {
        setSelectedIds((prev) => {
            const exists = prev.includes(id);
            let next;

            if (exists) {
                next = prev.filter((x) => x !== id);
            } else {
                next = [...prev, id];
            }

            setPercentages((p) => {
                const np = { ...p };

                if (exists) {
                    delete np[id];
                } else {
                    np[id] = next.length === 1 ? 100 : 0;

                    if (next.length === 2) {
                        const oldId = next[0];
                        np[oldId] = 0;
                    }
                }

                return np;
            });

            return next;
        });
    };

    /* ─── Equal distribute ─── */
    const equalDistribute = () => {
        if (selectedIds.length === 0) return;

        const each = round2(100 / selectedIds.length);
        const last = round2(100 - each * (selectedIds.length - 1));
        const np = {};

        selectedIds.forEach((id, i) => {
            np[id] = i === selectedIds.length - 1 ? last : each;
        });

        setPercentages(np);
    };

    /* ─── Percentage change ─── */
    const handlePctChange = (id, val) => {
        setPercentages((prev) => ({
            ...prev,
            [id]: val === "" ? "" : Number(val),
        }));
    };

    /* ─── Total percentage ─── */
    const totalPct = useMemo(() => {
        if (selectedIds.length <= 1) return 100;

        return round2(
            selectedIds.reduce((s, id) => s + Number(percentages[id] || 0), 0)
        );
    }, [selectedIds, percentages]);

    /* ─── File handling ─── */
    const handleFile = async (file) => {
        try {
            setIsLoading(true);
            setError("");
            setInfo("");
            setRows([]);
            setFileName(file.name);

            const parsed = await parseMuhasebeExcel(file);
            const prepared = (parsed.rows || []).map((r, index) => ({
                ...r,
                id: r.id ?? `${file.name}-${index}`,
                selected: false,
            }));

            setRows(prepared);
            setSheetName(parsed.sheetName || "");

            if (!prepared.length) {
                showModal("warning", "Veri Yok", "Excel okundu fakat kayıt bulunamadı.");
            } else {
                setInfo(`${file.name} yüklendi — ${prepared.length} kayıt`);
            }
        } catch (err) {
            const msg = `Excel okunamadı: ${err?.message || "Bilinmeyen hata"}`;
            setError(msg);
            showModal("error", "Hata", msg);
        } finally {
            setIsLoading(false);
        }
    };

    const onDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        const file = e.dataTransfer.files?.[0];
        if (file) await handleFile(file);
    };

    /* ─── Filters + Sort ─── */
    const filteredRows = useMemo(() => {
        let d = [...rows];

        if (filters.search.trim()) {
            const q = filters.search.toLocaleLowerCase("tr-TR");
            d = d.filter((r) =>
                r.rawText?.toLocaleLowerCase("tr-TR").includes(q)
            );
        }

        if (filters.hesapAdi) {
            d = d.filter((r) => r.hesapAdi === filters.hesapAdi);
        }

        if (filters.sorumlulukMerkezi) {
            d = d.filter(
                (r) => r.sorumlulukMerkeziAdi === filters.sorumlulukMerkezi
            );
        }

        if (filters.tarihBaslangic) {
            const s = new Date(filters.tarihBaslangic);
            d = d.filter((r) => r.tarihObj && r.tarihObj >= s);
        }

        if (filters.tarihBitis) {
            const e = new Date(filters.tarihBitis);
            e.setHours(23, 59, 59, 999);
            d = d.filter((r) => r.tarihObj && r.tarihObj <= e);
        }

        d.sort((a, b) => {
            const { key, direction } = sortConfig;
            const av = a[key];
            const bv = b[key];

            if (av == null && bv == null) return 0;
            if (av == null) return direction === "asc" ? -1 : 1;
            if (bv == null) return direction === "asc" ? 1 : -1;

            if (av instanceof Date && bv instanceof Date) {
                return direction === "asc" ? av - bv : bv - av;
            }

            if (typeof av === "number" && typeof bv === "number") {
                return direction === "asc" ? av - bv : bv - av;
            }

            return direction === "asc"
                ? String(av).localeCompare(String(bv), "tr")
                : String(bv).localeCompare(String(av), "tr");
        });

        return d;
    }, [rows, filters, sortConfig]);

    const handleSort = (key) => {
        setSortConfig((prev) => ({
            key,
            direction:
                prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    /* ─── Selection ─── */
    const toggleRow = (id) => {
        setRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r))
        );
    };

    const setFilteredSelected = (val) => {
        const ids = new Set(filteredRows.map((r) => r.id));
        setRows((prev) =>
            prev.map((r) => (ids.has(r.id) ? { ...r, selected: val } : r))
        );
    };

    const selectedRows = useMemo(
        () => rows.filter((r) => r.selected && Number(r.borc || 0) > 0),
        [rows]
    );

    const selectedDebt = useMemo(
        () => round2(selectedRows.reduce((s, r) => s + Number(r.borc || 0), 0)),
        [selectedRows]
    );

    const allFilteredSelected =
        filteredRows.length > 0 && filteredRows.every((r) => r.selected);

    const selectOptions = useMemo(
        () => ({
            hesapAdlari: uniqueValues(rows, "hesapAdi"),
            sorumlulukMerkezleri: uniqueValues(rows, "sorumlulukMerkeziAdi"),
        }),
        [rows]
    );

    /* ─── Save ─── */
    const handleSave = async () => {
        if (!selectedMonth) {
            showModal("warning", "Ay Seçilmedi", "Lütfen dönem ayı seçin.");
            return;
        }

        if (selectedIds.length === 0) {
            showModal(
                "warning",
                "Proje Seçilmedi",
                "En az 1 proje seçin."
            );
            return;
        }

        if (selectedRows.length === 0) {
            showModal(
                "warning",
                "Satır Seçilmedi",
                "Tabloda en az 1 satır seçin."
            );
            return;
        }

        if (selectedIds.length > 1 && totalPct !== 100) {
            showModal(
                "warning",
                "Yüzde Hatası",
                `Yüzde toplamı 100 olmalı. Şu an: %${totalPct}`
            );
            return;
        }

        try {
            setIsSaving(true);

            const selectedTargets = targetList.filter((t) =>
                selectedIds.includes(t.id)
            );

            const payload = [];

            const groupedByAccount = selectedRows.reduce((acc, row) => {
                const hesapAdi = String(row.hesapAdi || "BELİRSİZ").trim();
                const borc = round2(Number(row.borc || 0));

                if (!acc[hesapAdi]) {
                    acc[hesapAdi] = {
                        hesap_adi: hesapAdi,
                        toplam_borc: 0,
                        aciklamalar: [],
                    };
                }

                acc[hesapAdi].toplam_borc += borc;

                if (row.aciklama) {
                    acc[hesapAdi].aciklamalar.push(String(row.aciklama).trim());
                }

                return acc;
            }, {});

            Object.values(groupedByAccount).forEach((group) => {
                let kalan = round2(group.toplam_borc);

                selectedTargets.forEach((t, index) => {
                    const pct =
                        selectedIds.length === 1
                            ? 100
                            : Number(percentages[t.id] || 0);

                    let tutar = 0;

                    if (index === selectedTargets.length - 1) {
                        tutar = round2(kalan);
                    } else {
                        tutar = round2(group.toplam_borc * (pct / 100));
                        kalan = round2(kalan - tutar);
                    }

                    if (tutar <= 0) return;

                    payload.push({
                        kullanici_id: null,
                        proje_id: t.id,
                        hesap_adi: group.hesap_adi,
                        tutar,
                        donem_ayi: selectedMonth,
                        aciklama: group.aciklamalar
                            .slice(0, 5)
                            .join(" | ")
                            .slice(0, 250),
                        dagilim_orani: pct,
                    });
                });
            });

            const { error: e } = await supabase.from("muhasebe").insert(payload);
            if (e) throw e;



            /* Kaydedilen satırları tablodan sil */
            const selectedRowIds = new Set(selectedRows.map((r) => r.id));
            const kalanSatirSayisi = rows.filter(
                (r) => !selectedRowIds.has(r.id)
            ).length;

            setRows((prev) => prev.filter((r) => !selectedRowIds.has(r.id)));
            setSelectedIds([]);
            setPercentages({});
            setInfo(
                `${fileName || "Dosya"} için ${selectedRows.length} satır kaydedildi, kalan ${kalanSatirSayisi} satır gösteriliyor.`
            );

            showModal(
                "success",
                "Kaydedildi",
                `${selectedTargets.length} projeye toplam ${formatMoney(
                    selectedDebt
                )} dağıtıldı. Seçilen satırlar tablodan kaldırıldı.`
            );
        } catch (err) {
            showModal(
                "error",
                "Hata",
                err?.message || "Kayıt sırasında hata oluştu."
            );
        } finally {
            setIsSaving(false);
        }
    };

    /* ─── Render ─── */
    return (
        <>
            <div className="mk-page">
                {/* HEADER */}
                <div className="mk-header">
                    <div className="mk-header-left">
                        <div className="mk-chip">📊 Muhasebe Modülü</div>
                        <h1>Borç Dağıtımı</h1>
                        <p>Excel yükle · Satır seç · Projeye dağıt</p>
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                            className="btn btn-ghost"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                        >
                            📂 Excel Seç
                        </button>

                        <button
                            className="btn btn-ghost"
                            onClick={() => setFiltersOpen((p) => !p)}
                        >
                            🔍 {filtersOpen ? "Filtreyi Gizle" : "Filtrele"}
                        </button>

                        <button
                            className="btn btn-primary"
                            onClick={handleSave}
                            disabled={isSaving || !rows.length}
                        >
                            {isSaving ? "Kaydediliyor..." : "💾 Kaydet"}
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        hidden
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                        }}
                    />
                </div>

                {/* DROPZONE */}
                <div
                    className={`mk-dropzone ${dragActive ? "active" : ""} ${isLoading ? "loading" : ""}`}
                    onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isLoading) setDragActive(true);
                    }}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!isLoading) setDragActive(true);
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragActive(false);
                    }}
                    onDrop={onDrop}
                >
                    {isLoading ? (
                        <div className="mk-loading-box">
                            <div className="mk-spinner" />
                            <div style={{ fontWeight: 700 }}>Excel işleniyor...</div>
                        </div>
                    ) : (
                        <div className="mk-dropzone-inner">
                            <span className="mk-dropzone-icon">📊</span>
                            <div className="mk-dropzone-title">
                                Excel dosyasını sürükle & bırak
                            </div>
                            <div className="mk-dropzone-sub">
                                veya aşağıdaki butonu kullan
                            </div>
                            <button
                                className="mk-upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                📂 Dosya Seç
                            </button>
                        </div>
                    )}
                </div>

                {/* ALERTS */}
                {error && <div className="mk-alert error">⚠ {error}</div>}
                {info && <div className="mk-alert success">✓ {info}</div>}

                {/* FILE INFO */}
                {fileName && (
                    <div className="mk-file-bar">
                        <span>📄 <strong>{fileName}</strong></span>
                        <span>Sayfa: <strong>{sheetName}</strong></span>
                        <span>Toplam: <strong>{rows.length}</strong></span>
                        <span>Filtrelenen: <strong>{filteredRows.length}</strong></span>
                        <span>Seçili: <strong>{selectedRows.length}</strong></span>
                        <span>Seçili Borç: <strong>{formatMoney(selectedDebt)}</strong></span>
                    </div>
                )}

                {/* DISTRIBUTION PANEL */}
                <div className="mk-dist-panel">
                    <div className="mk-dist-panel-head">
                        <div>
                            <h2>Dağıtım Hedefi</h2>
                            <p>Seçili satırların toplam borcunu projelere dağıt</p>
                        </div>

                        {selectedIds.length > 1 && (
                            <button className="mk-equal-btn" onClick={equalDistribute}>
                                ⚖ Eşit Dağıt
                            </button>
                        )}
                    </div>

                    {/* Month + Targets */}
                    <div className="mk-dist-config">
                        <div className="mk-field">
                            <label>Dönem Ayı</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            >
                                <option value="">Seçiniz</option>
                                {MONTH_OPTIONS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                        {m.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mk-target-selector">
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 8,
                                    marginBottom: 8,
                                    flexWrap: "wrap",
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 700,
                                        color: "var(--text2)",
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                    }}
                                >
                                    Projeler
                                    {selectedIds.length > 0 && ` · ${selectedIds.length} seçili`}
                                </span>

                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {targetList.length > 0 && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={
                                                areAllTargetsSelected
                                                    ? () => {
                                                        setSelectedIds([]);
                                                        setPercentages({});
                                                    }
                                                    : handleSelectAllTargets
                                            }
                                        >
                                            {areAllTargetsSelected ? "Seçimi Temizle" : "Tümünü Seç"}
                                        </button>
                                    )}

                                    {selectedIds.length > 0 && !areAllTargetsSelected && (
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => {
                                                setSelectedIds([]);
                                                setPercentages({});
                                            }}
                                        >
                                            Temizle
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="mk-targets-list">
                                {targetList.map((item) => (
                                    <TargetItem
                                        key={item.id}
                                        item={item}
                                        selected={selectedIds.includes(item.id)}
                                        percentage={percentages[item.id]}
                                        onToggle={() => toggleTarget(item.id)}
                                        onPctChange={handlePctChange}
                                        showPct={true}
                                        singleSelected={
                                            selectedIds.length === 1 &&
                                            selectedIds[0] === item.id
                                        }
                                    />
                                ))}

                                {targetList.length === 0 && (
                                    <span style={{ fontSize: 12, color: "var(--text3)" }}>
                                        Proje bulunamadı.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer stats */}
                    <div className="mk-dist-footer">
                        <div className="mk-dist-stats">
                            <div className="mk-dist-stat">
                                <span className="mk-dist-stat-label">Seçili Satır</span>
                                <span className="mk-dist-stat-value">{selectedRows.length}</span>
                            </div>

                            <div className="mk-dist-stat">
                                <span className="mk-dist-stat-label">Toplam Borç</span>
                                <span className="mk-dist-stat-value green">
                                    {formatMoney(selectedDebt)}
                                </span>
                            </div>

                            <div className="mk-dist-stat">
                                <span className="mk-dist-stat-label">Proje</span>
                                <span className="mk-dist-stat-value">{selectedIds.length} seçili</span>
                            </div>
                        </div>

                        <div className="mk-dist-actions">
                            {selectedIds.length > 1 && (
                                <span className={`mk-pct-status ${totalPct === 100 ? "ok" : "bad"}`}>
                                    %{totalPct} {totalPct === 100 ? "✓" : "≠ 100"}
                                </span>
                            )}

                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? "Kaydediliyor..." : "💾 Kaydet"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* FILTERS */}
                {filtersOpen && (
                    <div className="mk-filter-bar">
                        <div className="mk-filter-bar-head">
                            <h3>🔍 Filtreler</h3>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setFilters(INIT_FILTERS)}
                            >
                                Temizle
                            </button>
                        </div>

                        <div className="mk-filters-grid">
                            <Field label="Arama">
                                <input
                                    type="text"
                                    value={filters.search}
                                    placeholder="Açıklama, hesap, kod..."
                                    onChange={(e) =>
                                        setFilters((p) => ({ ...p, search: e.target.value }))
                                    }
                                />
                            </Field>

                            <Field label="Hesap Adı">
                                <select
                                    value={filters.hesapAdi}
                                    onChange={(e) =>
                                        setFilters((p) => ({ ...p, hesapAdi: e.target.value }))
                                    }
                                >
                                    <option value="">Tümü</option>
                                    {selectOptions.hesapAdlari.map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Sorumluluk Merkezi">
                                <select
                                    value={filters.sorumlulukMerkezi}
                                    onChange={(e) =>
                                        setFilters((p) => ({
                                            ...p,
                                            sorumlulukMerkezi: e.target.value,
                                        }))
                                    }
                                >
                                    <option value="">Tümü</option>
                                    {selectOptions.sorumlulukMerkezleri.map((v) => (
                                        <option key={v} value={v}>
                                            {v}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field label="Başlangıç Tarihi">
                                <input
                                    type="date"
                                    value={filters.tarihBaslangic}
                                    onChange={(e) =>
                                        setFilters((p) => ({
                                            ...p,
                                            tarihBaslangic: e.target.value,
                                        }))
                                    }
                                />
                            </Field>

                            <Field label="Bitiş Tarihi">
                                <input
                                    type="date"
                                    value={filters.tarihBitis}
                                    onChange={(e) =>
                                        setFilters((p) => ({
                                            ...p,
                                            tarihBitis: e.target.value,
                                        }))
                                    }
                                />
                            </Field>
                        </div>
                    </div>
                )}

                {/* TABLE */}
                <div className="mk-table-panel">
                    <div className="mk-table-head">
                        <div className="mk-table-head-left">
                            <h2>Muhasebe Kayıtları</h2>
                            <p>
                                Filtrelenen: <strong>{filteredRows.length}</strong> ·
                                Seçili (borçlu): <strong>{selectedRows.length}</strong>
                            </p>
                        </div>

                        <div className="mk-table-head-right">
                            <label className="mk-select-all-label">
                                <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={(e) => setFilteredSelected(e.target.checked)}
                                />
                                Tümünü seç
                            </label>

                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setFilteredSelected(false)}
                            >
                                Seçimi temizle
                            </button>
                        </div>
                    </div>

                    <div className="mk-table-wrap">
                        <table className="mk-table">
                            <thead>
                                <tr>
                                    <th className="mk-sticky mk-check-col">Seç</th>
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="tarihObj" label="Tarih" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="sira" label="Sıra" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="yevmiyeNo" label="Y.No" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="fisTipi" label="Fiş Tipi" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="sorumlulukMerkeziKodu" label="S.M. Kodu" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="sorumlulukMerkeziAdi" label="S.M. Adı" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="aciklama" label="Açıklama" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="hesapKodu" label="H. Kodu" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="hesapAdi" label="Hesap Adı" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="borc" label="Borç" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="alacak" label="Alacak" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="borcBakiye" label="Borç Bakiye" />
                                    <SortableTH sortConfig={sortConfig} onSort={handleSort} keyName="alacakBakiye" label="Alacak Bakiye" />
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={14} className="mk-empty">
                                            <span className="mk-empty-icon">📭</span>
                                            Gösterilecek kayıt bulunamadı
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => (
                                        <tr key={row.id} className={row.selected ? "mk-row-selected" : ""}>
                                            <td className="mk-sticky mk-check-col">
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(row.selected)}
                                                    onChange={() => toggleRow(row.id)}
                                                />
                                            </td>
                                            <td>{formatDateTR(row.tarihObj || row.tarih)}</td>
                                            <td>{row.sira || "-"}</td>
                                            <td>{row.yevmiyeNo || "-"}</td>
                                            <td>{row.fisTipi || "-"}</td>
                                            <td>{row.sorumlulukMerkeziKodu || "-"}</td>
                                            <td>{row.sorumlulukMerkeziAdi || "-"}</td>
                                            <td className="mk-aciklama-cell">
                                                <div>{row.aciklama || "-"}</div>
                                            </td>
                                            <td>{row.hesapKodu || "-"}</td>
                                            <td>{row.hesapAdi || "-"}</td>
                                            <td><MoneyCell value={row.borc} /></td>
                                            <td><MoneyCell value={row.alacak} /></td>
                                            <td><MoneyCell value={row.borcBakiye} /></td>
                                            <td><MoneyCell value={row.alacakBakiye} /></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AlertModal
                open={modal.open}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                onClose={() => setModal((p) => ({ ...p, open: false }))}
            />
        </>
    );
}

/* ─── Helper field wrapper ─── */
function Field({ label, children }) {
    return (
        <div className="mk-field">
            <label>{label}</label>
            {children}
        </div>
    );
}