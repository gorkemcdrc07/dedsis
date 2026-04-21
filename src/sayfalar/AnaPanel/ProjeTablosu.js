import React, { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./ProjeTablosu.css";
import { fmt, norm } from "./helpers";
import PlateDetailModal from "./PlakaDetayPenceresi";
import { supabase } from "../../lib/supabase";

const IK_KEYWORDS = ["ik", "personel", "maaş", "sgk", "işçi", "çalışan", "prim"];
const MUH_KEYWORDS = ["muhasebe", "vergi", "kdv", "stopaj", "mali", "denetim", "fatura"];



function getSourceConfig(item) {
    const kaynak = String(item?.kaynak_tablo || "").toLowerCase().trim();

    if (kaynak === "ik") {
        return {
            tableName: "ik",
            idColumn: "id",
            fields: {
                hesap_adi: "hesap_adi",
                tutar: "tutar",
                proje_id: "proje_id",
            },
        };
    }

    if (kaynak === "muhasebe") {
        return {
            tableName: "muhasebe",
            idColumn: "id",
            fields: {
                hesap_adi: "hesap_adi",
                tutar: "tutar",
                proje_id: "proje_id",
            },
        };
    }

    return null;
}

function safeLower(value) {
    return String(value || "").trim().toLocaleLowerCase("tr-TR");
}

function normalizeProjects(allProjects = []) {
    const seen = new Set();

    return allProjects
        .map((p, index) => {
            const name = String(
                p.projectName ?? p.name ?? p.reel_proje_adi ?? p.proje_adi ?? ""
            ).trim();

            const id = p.id ?? p.projectId ?? p.proje_id ?? null;

            return {
                id,
                name,
                key:
                    id != null
                        ? `project-${id}`
                        : `project-name-${name || "bos"}-${index}`,
            };
        })
        .filter((p) => {
            if (!p.name) return false;

            const dedupeKey =
                p.id != null ? `id:${p.id}` : `name:${safeLower(p.name)}`;

            if (seen.has(dedupeKey)) return false;
            seen.add(dedupeKey);
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

function DagilimModal({
    open,
    mode,
    item,
    allProjects = [],
    loading,
    error,
    onClose,
    onSubmitEdit,
    onSubmitMove,
    onSubmitDelete,
}) {
    const [hesapAdi, setHesapAdi] = useState("");
    const [tutar, setTutar] = useState("");
    const [targetProjectValue, setTargetProjectValue] = useState("");

    const normalizedProjects = useMemo(
        () => normalizeProjects(allProjects),
        [allProjects]
    );

    useEffect(() => {
        if (!item || !open) return;

        setHesapAdi(item.hesap_adi || "");
        setTutar(String(item.tutar ?? "").replace(".", ","));
        setTargetProjectValue(item.proje_adi ? String(item.proje_adi) : "");
    }, [item, open]);

    if (!open || !item || !mode) return null;

    const titleMap = {
        edit: "Dağılım Kaydını Düzenle",
        move: "Kaydı Farklı Projeye Ata",
        delete: "Kaydı Sil",
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (mode === "edit") {
            const parsedTutar = Number(
                String(tutar).replace(/\./g, "").replace(",", ".").trim()
            );

            if (Number.isNaN(parsedTutar)) return;

            onSubmitEdit?.({
                hesap_adi: hesapAdi.trim(),
                tutar: parsedTutar,
            });
            return;
        }

        if (mode === "move") {
            const selectedProjectName = String(targetProjectValue || "").trim();

            if (!selectedProjectName) return;

            onSubmitMove?.({
                targetProjectName: selectedProjectName,
            });
            return;
        }

        if (mode === "delete") {
            onSubmitDelete?.();
        }
    };

    return (
        <div className="pt-modal-backdrop" onClick={onClose}>
            <div className="pt-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pt-modal-head">
                    <div>
                        <div className="pt-modal-title">{titleMap[mode]}</div>
                        <div className="pt-modal-subtitle">
                            {item.hesap_adi}
                            {item.kullanici_adi ? ` • ${item.kullanici_adi}` : ""}
                        </div>
                    </div>

                    <button
                        type="button"
                        className="pt-modal-close"
                        onClick={onClose}
                        disabled={loading}
                    >
                        ×
                    </button>
                </div>

                <form className="pt-modal-body" onSubmit={handleSubmit}>
                    {mode === "edit" && (
                        <div className="pt-form-grid">
                            <label className="pt-form-field">
                                <span>Hesap Adı</span>
                                <input
                                    className="pt-control pt-input"
                                    value={hesapAdi}
                                    onChange={(e) => setHesapAdi(e.target.value)}
                                    disabled={loading}
                                />
                            </label>

                            <label className="pt-form-field">
                                <span>Tutar</span>
                                <input
                                    className="pt-control pt-input"
                                    value={tutar}
                                    onChange={(e) => setTutar(e.target.value)}
                                    disabled={loading}
                                />
                            </label>
                        </div>
                    )}

                    {mode === "move" && (
                        <label className="pt-form-field">
                            <span>Hedef Proje</span>
                            <select
                                className="pt-control pt-select"
                                value={targetProjectValue}
                                onChange={(e) => setTargetProjectValue(e.target.value)}
                                disabled={loading}
                            >
                                <option value="">Proje seçin</option>
                                {normalizedProjects.map((p) => (
                                    <option key={p.key} value={p.name}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}

                    {mode === "delete" && (
                        <div className="pt-delete-box">
                            <div className="pt-delete-title">Bu kayıt silinecek.</div>
                            <div className="pt-delete-text">
                                Bu işlem geri alınamaz. Eminsen devam et.
                            </div>
                        </div>
                    )}

                    {error ? <div className="pt-form-error">{error}</div> : null}

                    <div className="pt-modal-actions">
                        <button
                            type="button"
                            className="pt-secondary-btn"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Vazgeç
                        </button>

                        {mode === "edit" && (
                            <button
                                type="submit"
                                className="pt-primary-btn"
                                disabled={loading}
                            >
                                {loading ? "Kaydediliyor..." : "Kaydet"}
                            </button>
                        )}

                        {mode === "move" && (
                            <button
                                type="submit"
                                className="pt-primary-btn"
                                disabled={loading || !String(targetProjectValue).trim()}
                            >
                                {loading ? "Taşınıyor..." : "Projeye Ata"}
                            </button>
                        )}

                        {mode === "delete" && (
                            <button
                                type="submit"
                                className="pt-danger-btn"
                                disabled={loading}
                            >
                                {loading ? "Siliniyor..." : "Sil"}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

function ServiceBreakdown({
    details,
    onPlateClick,
    projeDagilimRows = [],
    selectedMonth,
    allProjects = [],
    onUpdateDagilimRow,
    onMoveDagilimRow,
    onDeleteDagilimRow,
}) {
    const [svcF, setSvcF] = useState("");
    const [plateSearch, setPlateSearch] = useState("");
    const [openCats, setOpenCats] = useState({});
    const [busyRowId, setBusyRowId] = useState(null);
    const [openMenuRowId, setOpenMenuRowId] = useState(null);
    const [modalMode, setModalMode] = useState(null);
    const [activeItem, setActiveItem] = useState(null);
    const [modalError, setModalError] = useState("");

    const menuRef = useRef(null);

    const toggleCat = (key) =>
        setOpenCats((prev) => ({ ...prev, [key]: !prev[key] }));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuRowId(null);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredDetails = useMemo(() => details || [], [details]);
    const normalizedProjects = useMemo(
        () => normalizeProjects(allProjects),
        [allProjects]
    );

    const monthlyDagilim = useMemo(() => {
        return (projeDagilimRows || [])
            .filter(
                (row) =>
                    !selectedMonth ||
                    Number(row.donem_ay || 0) === Number(selectedMonth)
            )
            .map((row, index) => ({
                id:
                    row.kayit_id ||
                    row.id ||
                    `${row.proje_adi || ""}-${row.hesap_adi || ""}-${index}`,
                kayit_id:
                    row.kayit_id ||
                    row.id ||
                    `${row.proje_adi || ""}-${row.hesap_adi || ""}-${index}`,
                source_id: row.id || row.source_id || row.kayit_id,
                proje_id: row.proje_id || null,
                proje_adi: String(row.reel_proje_adi || row.proje_adi || "").trim(),
                reel_proje_adi: String(row.reel_proje_adi || row.proje_adi || "").trim(),
                kullanici_adi: String(row.kullanici_adi || "-").trim(),
                hesap_adi: String(row.hesap_adi || "-").trim(),
                alt_kalem: String(row.alt_kalem || "-").trim(),
                tutar: Number(row.tutar || 0),
                donem_ay: row.donem_ay || "",
                dagilim_orani: Number(row.dagilim_orani || 0),
                kaynak_tablo: String(row.kaynak_tablo || "").toLowerCase().trim(),
            }))
            .sort((a, b) => b.tutar - a.tutar);
    }, [projeDagilimRows, selectedMonth]);

    const categorize = React.useCallback((item) => {
        const text = `${item.hesap_adi} ${item.alt_kalem}`.toLowerCase();
        const kaynak = String(item.kaynak_tablo || "").toLowerCase().trim();
        const altKalem = String(item.alt_kalem || "").toLowerCase().trim();

        if (kaynak === "ik") return "ik";
        if (kaynak === "muhasebe") return "muhasebe";

        if (altKalem.includes("muhasebe")) return "muhasebe";
        if (altKalem.includes("ik")) return "ik";

        if (MUH_KEYWORDS.some((k) => text.includes(k))) return "muhasebe";
        if (IK_KEYWORDS.some((k) => text.includes(k))) return "ik";

        return "diger";
    }, []);

    const categorized = useMemo(() => {
        const groups = { ik: [], muhasebe: [], diger: [] };
        monthlyDagilim.forEach((item) => {
            groups[categorize(item)].push(item);
        });
        return groups;
    }, [monthlyDagilim, categorize]);

    const CAT_CONFIG = [
        { key: "ik", label: "İK", color: "#7C3AED" },
        { key: "muhasebe", label: "Muhasebe", color: "#059669" },
        { key: "diger", label: "Diğer", color: "#64748B" },
    ];

    const svcOpts = useMemo(
        () =>
            [
                ...new Set(
                    filteredDetails
                        .map((d) => d.ServiceExpenseName || d.ServiceExpense)
                        .filter((x) => x && x !== "-")
                ),
            ].sort((a, b) => a.localeCompare(b, "tr")),
        [filteredDetails]
    );

    const filtered = useMemo(() => {
        if (!svcF) return filteredDetails;
        return filteredDetails.filter((d) => {
            const serviceName = d.ServiceExpenseName || d.ServiceExpense || "";
            return norm(serviceName) === norm(svcF);
        });
    }, [filteredDetails, svcF]);

    const bySvc = useMemo(() => {
        const map = new Map();

        filtered.forEach((d) => {
            const key = d.ServiceExpenseName || d.ServiceExpense || "-";
            if (!map.has(key)) map.set(key, { name: key, p: 0, s: 0 });

            const g = map.get(key);
            g.p += Number(d.PurchaseInvoiceIncome || 0);
            g.s += Number(d.SalesInvoceIncome || 0);
        });

        return [...map.values()].sort((a, b) => b.p + b.s - (a.p + a.s));
    }, [filtered]);

    const byPlate = useMemo(() => {
        const unique = new Set();

        filtered.forEach((d) => {
            const plate = d.PlateNumber || "-";
            if (norm(plate).includes(norm(plateSearch))) unique.add(plate);
        });

        return [...unique].sort((a, b) => a.localeCompare(b, "tr"));
    }, [filtered, plateSearch]);

    const openModal = (mode, item) => {
        setModalError("");
        setOpenMenuRowId(null);
        setActiveItem(item);
        setModalMode(mode);
    };

    const closeModal = () => {
        if (busyRowId) return;
        setModalError("");
        setActiveItem(null);
        setModalMode(null);
    };

    const submitEdit = async (payload) => {
        if (!activeItem) return;

        try {
            setBusyRowId(activeItem.kayit_id);
            setModalError("");

            const config = getSourceConfig(activeItem);
            if (!config) {
                throw new Error("Kayıt kaynağı bulunamadı.");
            }

            const recordId = activeItem.source_id || activeItem.kayit_id;
            if (!recordId) {
                throw new Error("Kayıt id bulunamadı.");
            }

            const updatePayload = {
                [config.fields.hesap_adi]: payload.hesap_adi,
                [config.fields.tutar]: payload.tutar,
            };

            const { error } = await supabase
                .from(config.tableName)
                .update(updatePayload)
                .eq(config.idColumn, recordId);

            if (error) throw error;

            onUpdateDagilimRow?.(activeItem.kayit_id, payload);
            closeModal();
        } catch (error) {
            console.error("submitEdit error", error);
            setModalError(error.message || "Kayıt güncellenemedi.");
        } finally {
            setBusyRowId(null);
        }
    };

    const submitMove = async ({ targetProjectName }) => {
        if (!activeItem) return;

        try {
            setBusyRowId(activeItem.kayit_id);
            setModalError("");

            const config = getSourceConfig(activeItem);
            if (!config) {
                throw new Error("Kayıt kaynağı bulunamadı.");
            }

            const recordId = activeItem.source_id || activeItem.kayit_id;
            if (!recordId) {
                throw new Error("Kayıt id bulunamadı.");
            }

            const selectedProjectName = String(targetProjectName || "").trim();
            if (!selectedProjectName) {
                throw new Error("Lütfen proje seçin.");
            }

            const localProject = normalizedProjects.find(
                (p) => safeLower(p.name) === safeLower(selectedProjectName)
            );

            const { data: projectRows, error: projectFindError } = await supabase
                .from("projeler")
                .select("id, proje_adi, reel_proje_adi");

            if (projectFindError) throw projectFindError;

            const projectRow =
                (projectRows || []).find(
                    (p) =>
                        safeLower(p.reel_proje_adi) === safeLower(selectedProjectName) ||
                        safeLower(p.proje_adi) === safeLower(selectedProjectName)
                ) || null;

            if (!projectRow?.id) {
                throw new Error("Seçilen proje bulunamadı.");
            }

            const finalProjectId = Number(projectRow.id);
            const finalProjectName =
                String(projectRow.reel_proje_adi || projectRow.proje_adi || localProject?.name || "").trim();

            const { error } = await supabase
                .from(config.tableName)
                .update({
                    [config.fields.proje_id]: finalProjectId,
                })
                .eq(config.idColumn, recordId)
                .select();

            if (error) throw error;

            onMoveDagilimRow?.(
                activeItem.kayit_id,
                finalProjectName,
                finalProjectId
            );

            closeModal();
        } catch (error) {
            console.error("submitMove error", error);
            setModalError(error.message || "Kayıt farklı projeye taşınamadı.");
        } finally {
            setBusyRowId(null);
        }
    };

    const submitDelete = async () => {
        if (!activeItem) return;

        try {
            setBusyRowId(activeItem.kayit_id);
            setModalError("");

            const config = getSourceConfig(activeItem);
            if (!config) {
                throw new Error("Kayıt kaynağı bulunamadı.");
            }

            const recordId = activeItem.source_id || activeItem.kayit_id;
            if (!recordId) {
                throw new Error("Kayıt id bulunamadı.");
            }

            const { error } = await supabase
                .from(config.tableName)
                .delete()
                .eq(config.idColumn, recordId);

            if (error) throw error;

            onDeleteDagilimRow?.(activeItem.kayit_id);
            closeModal();
        } catch (error) {
            console.error("submitDelete error", error);
            setModalError(error.message || "Kayıt silinemedi.");
        } finally {
            setBusyRowId(null);
        }
    };

    return (
        <>
            <div className="pt-detail-shell">
                <div className="pt-detail-toolbar">
                    <select
                        className="pt-control pt-select"
                        value={svcF}
                        onChange={(e) => setSvcF(e.target.value)}
                    >
                        <option value="">Tüm hizmetler</option>
                        {svcOpts.map((o) => (
                            <option key={o} value={o}>
                                {o}
                            </option>
                        ))}
                    </select>

                    <input
                        className="pt-control pt-input"
                        placeholder="Plaka filtrele..."
                        value={plateSearch}
                        onChange={(e) => setPlateSearch(e.target.value)}
                    />
                </div>

                <div className="pt-detail-grid">
                    <section className="pt-panel pt-panel-services">
                        <div className="pt-panel-title">Hizmet / Masraf ({bySvc.length})</div>

                        {bySvc.length === 0 ? (
                            <div className="pt-empty">Veri yok</div>
                        ) : (
                            <div className="pt-scroll pt-service-scroll pt-service-list">
                                {bySvc.map((s) => {
                                    const showSales = Number(s.s) !== 0;
                                    const showPurchase = Number(s.p) !== 0;

                                    return (
                                        <div className="pt-service-row" key={s.name}>
                                            <div className="pt-service-main">
                                                <div className="pt-service-name">{s.name}</div>
                                            </div>

                                            <div className="pt-service-metrics">
                                                {showSales && (
                                                    <div className="pt-metric-box">
                                                        <span>Satış</span>
                                                        <strong>{fmt(s.s, true)}</strong>
                                                    </div>
                                                )}

                                                {showPurchase && (
                                                    <div className="pt-metric-box">
                                                        <span>Alış</span>
                                                        <strong>{fmt(s.p, true)}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="pt-panel pt-panel-costs">
                        <div className="pt-panel-title">
                            Genel Dağılım Maliyetleri ({monthlyDagilim.length})
                        </div>

                        {monthlyDagilim.length === 0 ? (
                            <div className="pt-empty">Dağılım verisi yok</div>
                        ) : (
                            <div className="pt-scroll pt-cost-scroll">
                                {CAT_CONFIG.map(({ key, label, color }) => {
                                    const items = categorized[key];
                                    if (items.length === 0) return null;

                                    const total = items.reduce((sum, item) => sum + item.tutar, 0);
                                    const isOpen = !!openCats[key];

                                    return (
                                        <div key={key}>
                                            <div
                                                className={`pt-cat-header${isOpen ? " open" : ""}`}
                                                onClick={() => toggleCat(key)}
                                            >
                                                <div className="pt-cat-left">
                                                    <span
                                                        className="pt-cat-dot"
                                                        style={{ background: color }}
                                                    />
                                                    <span className="pt-cat-name">{label}</span>
                                                    <span className="pt-cat-count">{items.length} kalem</span>
                                                </div>

                                                <div className="pt-cat-right">
                                                    <span className="pt-cat-total">{fmt(total, true)}</span>
                                                    <span className="pt-cat-chevron">{isOpen ? "▲" : "▼"}</span>
                                                </div>
                                            </div>

                                            {isOpen && (
                                                <div className="pt-cat-body">
                                                    {items.map((item) => {
                                                        const isBusy = busyRowId === item.kayit_id;
                                                        const isMenuOpen = openMenuRowId === item.kayit_id;

                                                        return (
                                                            <div
                                                                className="pt-cat-item"
                                                                key={item.kayit_id}
                                                            >
                                                                <div className="pt-cat-item-main">
                                                                    <div className="pt-cat-item-top">
                                                                        <div className="pt-cat-item-title">
                                                                            {String(item.hesap_adi).toUpperCase()}
                                                                        </div>

                                                                        <div
                                                                            className="pt-item-menu-wrap"
                                                                            ref={isMenuOpen ? menuRef : null}
                                                                        >
                                                                            <button
                                                                                type="button"
                                                                                className="pt-icon-btn"
                                                                                disabled={isBusy}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setOpenMenuRowId((prev) =>
                                                                                        prev === item.kayit_id ? null : item.kayit_id
                                                                                    );
                                                                                }}
                                                                                title="İşlemler"
                                                                            >
                                                                                ⋯
                                                                            </button>

                                                                            {isMenuOpen && (
                                                                                <div className="pt-item-menu">
                                                                                    <button
                                                                                        type="button"
                                                                                        className="pt-item-menu-btn"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            openModal("edit", item);
                                                                                        }}
                                                                                    >
                                                                                        Düzenle
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="pt-item-menu-btn"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            openModal("move", item);
                                                                                        }}
                                                                                    >
                                                                                        Farklı projeye ata
                                                                                    </button>

                                                                                    <button
                                                                                        type="button"
                                                                                        className="pt-item-menu-btn danger"
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            openModal("delete", item);
                                                                                        }}
                                                                                    >
                                                                                        Sil
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="pt-cat-item-sub">
                                                                        {item.alt_kalem}
                                                                        {item.kullanici_adi
                                                                            ? ` • ${item.kullanici_adi}`
                                                                            : ""}
                                                                    </div>

                                                                    <div className="pt-cat-item-meta">
                                                                        Proje: {item.proje_adi || "-"}
                                                                    </div>
                                                                </div>

                                                                <div className="pt-cat-item-side">
                                                                    <div className="pt-cat-item-amount">
                                                                        {fmt(item.tutar, true)}
                                                                    </div>

                                                                    {isBusy && (
                                                                        <div className="pt-cat-item-loading">
                                                                            Kaydediliyor...
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section className="pt-panel pt-panel-plates">
                        <div className="pt-panel-title">Plakalar ({byPlate.length})</div>

                        {byPlate.length === 0 ? (
                            <div className="pt-empty">Veri yok</div>
                        ) : (
                            <div className="pt-plate-grid">
                                {byPlate.map((plate) => (
                                    <button
                                        key={plate}
                                        type="button"
                                        className="pt-plate-chip"
                                        onClick={() => onPlateClick?.(plate)}
                                        title={plate}
                                    >
                                        {plate}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            <DagilimModal
                open={!!modalMode && !!activeItem}
                mode={modalMode}
                item={activeItem}
                allProjects={allProjects}
                loading={!!busyRowId}
                error={modalError}
                onClose={closeModal}
                onSubmitEdit={submitEdit}
                onSubmitMove={submitMove}
                onSubmitDelete={submitDelete}
            />
        </>
    );
}

const CURRENCY_FORMAT = '#,##0.00 [$₺-tr-TR]';
const PERCENT_FORMAT = "0.00%";

function money(v) {
    return Number(v || 0);
}

function percent(v) {
    return Number(v || 0);
}

function setThinBorder(cell, color = "D9E2F2") {
    cell.border = {
        top: { style: "thin", color: { argb: color } },
        left: { style: "thin", color: { argb: color } },
        bottom: { style: "thin", color: { argb: color } },
        right: { style: "thin", color: { argb: color } },
    };
}

function styleCell(cell, opts = {}) {
    const {
        bold = false,
        size,
        color,
        bg,
        align = "left",
        valign = "middle",
        numFmt,
        border = true,
        wrap = false,
    } = opts;

    cell.font = {
        name: "Aptos",
        size: size || 11,
        bold,
        color: color ? { argb: color } : undefined,
    };

    if (bg) {
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: bg },
        };
    }

    cell.alignment = {
        horizontal: align,
        vertical: valign,
        wrapText: wrap,
    };

    if (numFmt) {
        cell.numFmt = numFmt;
    }

    if (border) {
        setThinBorder(cell);
    }
}

function mergeAndStyle(ws, range, value, opts = {}) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
    styleCell(cell, opts);
    return cell;
}

function addSpacerRow(ws, height = 8) {
    const row = ws.addRow([]);
    row.height = height;
    return row;
}

function addSectionTitle(ws, rowIndex, title) {
    mergeAndStyle(ws, `A${rowIndex}:H${rowIndex}`, title, {
        bold: true,
        size: 13,
        color: "1E3A8A",
        bg: "EAF2FF",
        align: "left",
    });
    ws.getRow(rowIndex).height = 22;
}

function addTableHeader(ws, rowIndex, headers) {
    const row = ws.getRow(rowIndex);
    headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = header;
        styleCell(cell, {
            bold: true,
            size: 10,
            color: "5B6B83",
            bg: "F3F7FD",
            align: idx === 0 || idx === 1 ? "left" : "center",
        });
    });
    row.height = 20;
}

function addDataRow(ws, values, config = {}) {
    const row = ws.addRow(values);

    row.eachCell((cell, colNumber) => {
        styleCell(cell, {
            size: 10.5,
            color: "1F2937",
            align: colNumber <= (config.leftCols || 2) ? "left" : "right",
            wrap: !!config.wrap,
        });
    });

    if (config.currencyCols) {
        config.currencyCols.forEach((col) => {
            row.getCell(col).numFmt = CURRENCY_FORMAT;
        });
    }

    if (config.percentCols) {
        config.percentCols.forEach((col) => {
            row.getCell(col).numFmt = PERCENT_FORMAT;
        });
    }

    if (config.highlightProfitCol) {
        const cell = row.getCell(config.highlightProfitCol);
        const val = Number(cell.value || 0);

        cell.font = {
            ...(cell.font || {}),
            bold: true,
            color: { argb: val >= 0 ? "15803D" : "B91C1C" },
        };
    }

    if (config.fill) {
        row.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: config.fill },
            };
        });
    }

    return row;
}

function addInfoCardRow(ws, rowIndex, startCol, title, value, opts = {}) {
    const titleCell = ws.getCell(rowIndex, startCol);
    const valueCell = ws.getCell(rowIndex + 1, startCol);

    ws.mergeCells(rowIndex, startCol, rowIndex, startCol + 1);
    ws.mergeCells(rowIndex + 1, startCol, rowIndex + 1, startCol + 1);

    titleCell.value = title;
    styleCell(titleCell, {
        bold: true,
        size: 10,
        color: "64748B",
        bg: "F8FBFF",
        align: "left",
    });

    valueCell.value = value;
    styleCell(valueCell, {
        bold: true,
        size: 14,
        color: opts.valueColor || "0F172A",
        bg: "FFFFFF",
        align: "left",
        numFmt: opts.numFmt,
    });

    ws.getRow(rowIndex).height = 18;
    ws.getRow(rowIndex + 1).height = 24;
}

export default function ProjeTablosu({
    projects = [],
    allRows = [],
    projeDagilimRows = [],
    selectedMonth,
}) {
    const [expanded, setExpanded] = useState(null);
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState("profit");
    const [selPlate, setSelPlate] = useState(null);
    const [dagilimStateRows, setDagilimStateRows] = useState(projeDagilimRows || []);

    useEffect(() => {
        setDagilimStateRows(projeDagilimRows || []);
    }, [projeDagilimRows]);

    const filteredDagilimRows = useMemo(() => {
        if (!selectedMonth) return dagilimStateRows || [];

        return (dagilimStateRows || []).filter(
            (row) => Number(row.donem_ay || 0) === Number(selectedMonth)
        );
    }, [dagilimStateRows, selectedMonth]);

    const monthlyDagilimTotal = useMemo(() => {
        return filteredDagilimRows.reduce(
            (sum, row) => sum + Number(row.tutar || 0),
            0
        );
    }, [filteredDagilimRows]);

    const enrichedProjects = useMemo(() => {
        return projects.map((project, index) => {
            const projectDagilim = filteredDagilimRows.filter(
                (row) =>
                    norm(row.reel_proje_adi || row.proje_adi) === norm(project.projectName)
            );

            const dagitimToplamAlis = projectDagilim.reduce(
                (sum, row) => sum + Number(row.tutar || 0),
                0
            );

            const yeniAlis = Number(project.purchaseTotal || 0) + dagitimToplamAlis;
            const yeniKar = Number(project.salesTotal || 0) - yeniAlis;

            return {
                ...project,
                key:
                    project.id ??
                    project.projectId ??
                    project.reel_proje_adi ??
                    project.projectName ??
                    `project-${index}`,
                dagitimToplamAlis,
                purchaseTotalWithDagilim: yeniAlis,
                profitWithDagilim: yeniKar,
            };
        });
    }, [projects, filteredDagilimRows]);

    const filtered = useMemo(() => {
        const s = [...enrichedProjects].filter((p) =>
            norm(p.projectName).includes(norm(search))
        );

        s.sort((a, b) =>
            sort === "profit"
                ? b.profitWithDagilim - a.profitWithDagilim
                : sort === "purchase"
                    ? b.purchaseTotalWithDagilim - a.purchaseTotalWithDagilim
                    : sort === "sales"
                        ? b.salesTotal - a.salesTotal
                        : b.plateCount - a.plateCount
        );

        return s;
    }, [enrichedProjects, search, sort]);

    const totals = useMemo(() => {
        const projectTotals = filtered.reduce(
            (a, p) => ({
                p: a.p + Number(p.purchaseTotalWithDagilim || 0),
                s: a.s + Number(p.salesTotal || 0),
                basePurchase: a.basePurchase + Number(p.purchaseTotal || 0),
                dagilim: a.dagilim + Number(p.dagitimToplamAlis || 0),
                plates: a.plates + Number(p.plateCount || 0),
            }),
            { p: 0, s: 0, basePurchase: 0, dagilim: 0, plates: 0 }
        );

        return {
            ...projectTotals,
            p: projectTotals.p,
        };
    }, [filtered]);

    const totalProfit = totals.s - totals.p;
    const totalProfitability = totals.s > 0 ? totalProfit / totals.s : 0;

    const getProfitability = (project) => {
        if (!project.salesTotal) return 0;
        return Number(project.profitWithDagilim || 0) / Number(project.salesTotal || 0);
    };

    const formatPercent = (value) => `%${(value * 100).toFixed(1)}`;

    const handleUpdateDagilimRow = (rowId, patch) => {
        setDagilimStateRows((prev) =>
            prev.map((row) => {
                const currentId = row.kayit_id || row.id;
                if (String(currentId) !== String(rowId)) return row;
                return { ...row, ...patch };
            })
        );
    };

    const handleMoveDagilimRow = (rowId, targetProjectName, targetProjectId) => {
        setDagilimStateRows((prev) =>
            prev.map((row) => {
                const currentId = row.kayit_id || row.id;
                if (String(currentId) !== String(rowId)) return row;
                return {
                    ...row,
                    proje_id: targetProjectId,
                    proje_adi: targetProjectName,
                    reel_proje_adi: targetProjectName,
                };
            })
        );
    };

    const handleDeleteDagilimRow = (rowId) => {
        setDagilimStateRows((prev) =>
            prev.filter((row) => String(row.kayit_id || row.id) !== String(rowId))
        );
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.lastModifiedBy = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const ws = workbook.addWorksheet("Rapor", {
            properties: { defaultRowHeight: 20 },
            views: [{ state: "frozen", ySplit: 6 }],
        });

        ws.columns = [
            { key: "a", width: 28 },
            { key: "b", width: 18 },
            { key: "c", width: 18 },
            { key: "d", width: 18 },
            { key: "e", width: 18 },
            { key: "f", width: 18 },
            { key: "g", width: 18 },
            { key: "h", width: 18 },
        ];

        mergeAndStyle(ws, "A1:H1", "PROJE KARLILIK RAPORU", {
            bold: true,
            size: 18,
            color: "FFFFFF",
            bg: "1D4ED8",
            align: "center",
        });

        mergeAndStyle(
            ws,
            "A2:H2",
            `Rapor Dönemi: ${selectedMonth || "Tümü"}  •  Oluşturulma: ${new Date().toLocaleString("tr-TR")}`,
            {
                bold: false,
                size: 10,
                color: "475569",
                bg: "F8FBFF",
                align: "center",
            }
        );

        addSpacerRow(ws, 8);

        addInfoCardRow(ws, 4, 1, "Toplam Proje", filtered.length, {});
        addInfoCardRow(ws, 4, 3, "Toplam Satış", money(totals.s), {
            numFmt: CURRENCY_FORMAT,
            valueColor: "0F172A",
        });
        addInfoCardRow(ws, 4, 5, "Toplam Alış", money(totals.p), {
            numFmt: CURRENCY_FORMAT,
            valueColor: "0F172A",
        });
        addInfoCardRow(ws, 4, 7, "Toplam Kâr", money(totalProfit), {
            numFmt: CURRENCY_FORMAT,
            valueColor: totalProfit >= 0 ? "15803D" : "B91C1C",
        });

        const profitabilityTitle = ws.getCell("G4");
        const profitabilityValue = ws.getCell("G5");
        profitabilityTitle.value = "Toplam Karlılık";
        profitabilityValue.value = percent(totalProfitability);
        profitabilityValue.numFmt = PERCENT_FORMAT;
        profitabilityValue.font = {
            name: "Aptos",
            size: 14,
            bold: true,
            color: { argb: totalProfitability >= 0 ? "15803D" : "B91C1C" },
        };

        addSpacerRow(ws, 10);

        let rowIndex = 7;
        addSectionTitle(ws, rowIndex, "GENEL PROJE ÖZETİ");
        rowIndex += 1;

        addTableHeader(ws, rowIndex, [
            "Proje Adı",
            "Plaka Sayısı",
            "Satış",
            "Alış",
            "Kâr / Zarar",
            "Karlılık",
        ]);
        rowIndex += 1;

        filtered.forEach((p) => {
            const profitability = getProfitability(p);

            const row = addDataRow(
                ws,
                [
                    p.projectName,
                    Number(p.plateCount || 0),
                    money(p.salesTotal),
                    money(p.purchaseTotalWithDagilim),
                    money(p.profitWithDagilim),
                    percent(profitability),
                ],
                {
                    leftCols: 1,
                    currencyCols: [3, 4, 5],
                    percentCols: [6],
                    highlightProfitCol: 5,
                }
            );

            row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
            row.getCell(6).font = {
                name: "Aptos",
                size: 10.5,
                bold: true,
                color: { argb: profitability >= 0 ? "15803D" : "B91C1C" },
            };
            rowIndex += 1;
        });

        const totalRow = addDataRow(
            ws,
            [
                "Genel Toplam",
                "",
                money(totals.s),
                money(totals.p),
                money(totalProfit),
                percent(totalProfitability),
            ],
            {
                leftCols: 1,
                currencyCols: [3, 4, 5],
                percentCols: [6],
                highlightProfitCol: 5,
                fill: "F8FBFF",
            }
        );

        totalRow.eachCell((cell) => {
            cell.font = {
                name: "Aptos",
                size: 11,
                bold: true,
                color: { argb: "0F172A" },
            };
        });

        rowIndex += 2;

        filtered.forEach((project, index) => {
            const profitability = getProfitability(project);

            addSectionTitle(
                ws,
                rowIndex,
                `${index + 1}. PROJE DETAYI — ${project.projectName}`
            );
            rowIndex += 1;

            addTableHeader(ws, rowIndex, [
                "Proje",
                "Plaka",
                "Satış",
                "Alış",
                "Toplam Alış",
                "Kâr / Zarar",
                "Karlılık",
                "Not",
            ]);
            rowIndex += 1;

            addDataRow(
                ws,
                [
                    project.projectName,
                    Number(project.plateCount || 0),
                    money(project.salesTotal),
                    money(project.purchaseTotal),
                    money(project.purchaseTotalWithDagilim),
                    money(project.profitWithDagilim),
                    percent(profitability),
                    selectedMonth || "Tümü",
                ],
                {
                    leftCols: 1,
                    currencyCols: [3, 4, 5, 6],
                    percentCols: [7],
                    highlightProfitCol: 6,
                }
            );
            rowIndex += 1;

            const serviceMap = new Map();
            (project.details || []).forEach((d) => {
                const key = d.ServiceExpenseName || d.ServiceExpense || "-";
                if (!serviceMap.has(key)) {
                    serviceMap.set(key, { service: key, sales: 0, purchase: 0 });
                }
                const item = serviceMap.get(key);
                item.sales += Number(d.SalesInvoceIncome || 0);
                item.purchase += Number(d.PurchaseInvoiceIncome || 0);
            });

            const serviceRows = [...serviceMap.values()]
                .map((s) => ({
                    ...s,
                    profit: s.sales - s.purchase,
                }))
                .sort((a, b) => b.purchase - a.purchase);

            rowIndex += 1;
            addSectionTitle(ws, rowIndex, "HİZMET / MASRAF ÖZETİ");
            rowIndex += 1;
            addTableHeader(ws, rowIndex, [
                "Hizmet / Masraf",
                "Satış",
                "Alış",
                "Kâr",
                "",
                "",
                "",
                "",
            ]);
            rowIndex += 1;

            if (serviceRows.length === 0) {
                const emptyRow = ws.addRow(["Veri yok"]);
                ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                styleCell(emptyRow.getCell(1), {
                    color: "94A3B8",
                    align: "center",
                    bg: "FCFDFF",
                });
                rowIndex += 1;
            } else {
                serviceRows.forEach((s) => {
                    addDataRow(
                        ws,
                        [s.service, money(s.sales), money(s.purchase), money(s.profit), "", "", "", ""],
                        {
                            leftCols: 1,
                            currencyCols: [2, 3, 4],
                            highlightProfitCol: 4,
                        }
                    );
                    rowIndex += 1;
                });
            }

            const monthlyDagilimRows = filteredDagilimRows
                .filter(
                    (row) =>
                        norm(row.reel_proje_adi || row.proje_adi) === norm(project.projectName)
                )
                .map((row) => ({
                    kullanici_adi: row.kullanici_adi || "-",
                    hesap_adi: row.hesap_adi || "-",
                    alt_kalem: row.alt_kalem || "-",
                    tutar: Number(row.tutar || 0),
                    donem_ay: row.donem_ay || "",
                }))
                .sort((a, b) => b.tutar - a.tutar);

            rowIndex += 1;
            addSectionTitle(ws, rowIndex, "GENEL DAĞILIM MALİYETLERİ");
            rowIndex += 1;
            addTableHeader(ws, rowIndex, [
                "Kullanıcı",
                "Hesap",
                "Alt Kalem",
                "Tutar",
                "Dönem",
                "",
                "",
                "",
            ]);
            rowIndex += 1;

            if (monthlyDagilimRows.length === 0) {
                const emptyRow = ws.addRow(["Dağılım verisi yok"]);
                ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                styleCell(emptyRow.getCell(1), {
                    color: "94A3B8",
                    align: "center",
                    bg: "FCFDFF",
                });
                rowIndex += 1;
            } else {
                monthlyDagilimRows.forEach((item) => {
                    addDataRow(
                        ws,
                        [
                            item.kullanici_adi,
                            item.hesap_adi,
                            item.alt_kalem,
                            money(item.tutar),
                            item.donem_ay,
                            "",
                            "",
                            "",
                        ],
                        {
                            leftCols: 3,
                            currencyCols: [4],
                        }
                    );
                    rowIndex += 1;
                });
            }

            const plates = [
                ...new Set((project.details || []).map((d) => d.PlateNumber || "-")),
            ].sort((a, b) => String(a).localeCompare(String(b), "tr"));

            rowIndex += 1;
            addSectionTitle(ws, rowIndex, "PLAKALAR");
            rowIndex += 1;
            addTableHeader(ws, rowIndex, [
                "Plaka",
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]);
            rowIndex += 1;

            if (plates.length === 0) {
                const emptyRow = ws.addRow(["Veri yok"]);
                ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                styleCell(emptyRow.getCell(1), {
                    color: "94A3B8",
                    align: "center",
                    bg: "FCFDFF",
                });
                rowIndex += 1;
            } else {
                plates.forEach((plate) => {
                    const row = ws.addRow([plate]);
                    ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
                    const cell = row.getCell(1);
                    styleCell(cell, {
                        bold: true,
                        size: 10.5,
                        color: "1D4ED8",
                        bg: "F8FBFF",
                        align: "left",
                    });
                    rowIndex += 1;
                });
            }

            rowIndex += 1;
        });

        ws.eachRow((row) => {
            row.eachCell((cell) => {
                if (!cell.alignment) {
                    cell.alignment = { vertical: "middle" };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const fileData = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(fileData, `proje-raporu-modern-${selectedMonth || "tum-aylar"}.xlsx`);
    };

    return (
        <div className="pt-page">
            <PlateDetailModal
                plateNumber={selPlate}
                allRows={allRows}
                onClose={() => setSelPlate(null)}
            />

            <div className="pt-card">
                <div className="pt-card-head">
                    <div className="pt-toolbar-top">
                        <div className="pt-toolbar-left">
                            <div className="pt-search-wrap">
                                <span className="pt-search-icon">⌕</span>
                                <input
                                    className="pt-control pt-search"
                                    placeholder="Proje ara..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="pt-sort-wrap">
                                <select
                                    className="pt-control pt-select pt-sort-select"
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value)}
                                >
                                    <option value="profit">Kâra göre</option>
                                    <option value="purchase">Alışa göre</option>
                                    <option value="sales">Satışa göre</option>
                                    <option value="plates">Plaka sayısına göre</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-toolbar-right">
                            <button
                                type="button"
                                className="pt-export-btn"
                                onClick={handleExportExcel}
                                title="Modern Excel raporu oluştur"
                            >
                                <span className="pt-export-icon">⬇</span>
                                Excel’e Aktar
                            </button>
                        </div>
                    </div>

                    <div className="pt-toolbar-bottom">
                        <span className="pt-tag">{filtered.length} proje</span>
                        <span className="pt-tag">Ay: {selectedMonth || "Tümü"}</span>
                        <span className="pt-tag">
                            Genel Dağılım: {fmt(monthlyDagilimTotal, true)}
                        </span>
                    </div>
                </div>

                <div className="pt-table-wrap">
                    <table className="pt-table">
                        <thead>
                            <tr>
                                <th className="pt-col-toggle"></th>
                                <th className="pt-col-project">Proje Adı</th>
                                <th className="pt-col-plate">Sefer / Plaka</th>
                                <th className="pt-col-money">Satış</th>
                                <th className="pt-col-money">Alış</th>
                                <th className="pt-col-money">Kâr / Zarar</th>
                                <th className="pt-col-profit">Karlılık</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <div className="pt-empty">Proje bulunamadı.</div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((project, index) => {
                                    const projectRowKey =
                                        project.key ??
                                        project.id ??
                                        project.projectId ??
                                        project.projectName ??
                                        `project-row-${index}`;

                                    const isOpen = expanded === projectRowKey;
                                    const profitability = getProfitability(project);

                                    return (
                                        <React.Fragment key={projectRowKey}>
                                            <tr
                                                className={`pt-row ${isOpen ? "expanded" : ""}`}
                                                onClick={() =>
                                                    setExpanded((prev) =>
                                                        prev === projectRowKey ? null : projectRowKey
                                                    )
                                                }
                                            >
                                                <td className="pt-col-toggle pt-center">
                                                    <span className="pt-chevron">
                                                        {isOpen ? "▲" : "▼"}
                                                    </span>
                                                </td>

                                                <td className="pt-project-name pt-col-project">
                                                    {project.projectName}
                                                </td>

                                                <td className="pt-center pt-col-plate">
                                                    <span className="pt-pill pt-pill-neutral">
                                                        {project.plateCount}
                                                    </span>
                                                </td>

                                                <td className="pt-right pt-money pt-col-money">
                                                    {fmt(project.salesTotal, true)}
                                                </td>

                                                <td className="pt-right pt-money pt-col-money">
                                                    {fmt(project.purchaseTotalWithDagilim, true)}
                                                </td>

                                                <td className="pt-right pt-money pt-col-money">
                                                    <strong>{fmt(project.profitWithDagilim, true)}</strong>
                                                </td>

                                                <td className="pt-right pt-col-profit">
                                                    <span
                                                        className={`pt-ratio-pill ${profitability >= 0 ? "pos" : "neg"}`}
                                                        title="Kâr / Satış"
                                                    >
                                                        {formatPercent(profitability)}
                                                    </span>
                                                </td>
                                            </tr>

                                            {isOpen && (
                                                <tr>
                                                    <td colSpan={7} className="pt-expanded-cell">
                                                        <ServiceBreakdown
                                                            details={project.details}
                                                            onPlateClick={setSelPlate}
                                                            projeDagilimRows={filteredDagilimRows.filter((row) => {
                                                                const rowProjectName = norm(row.reel_proje_adi || row.proje_adi || "");
                                                                const currentProjectName = norm(project.projectName || "");
                                                                const currentRealProjectName = norm(project.reel_proje_adi || "");

                                                                return (
                                                                    rowProjectName === currentProjectName ||
                                                                    (currentRealProjectName && rowProjectName === currentRealProjectName)
                                                                );
                                                            })}
                                                            selectedMonth={selectedMonth}
                                                            allProjects={projects}
                                                            onUpdateDagilimRow={handleUpdateDagilimRow}
                                                            onMoveDagilimRow={handleMoveDagilimRow}
                                                            onDeleteDagilimRow={handleDeleteDagilimRow}
                                                        />
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>

                        <tfoot>
                            <tr>
                                <td className="pt-col-toggle pt-center"></td>

                                <td className="pt-foot-label pt-col-project">
                                    Genel Toplam
                                </td>

                                <td className="pt-center pt-col-plate">
                                    <span className="pt-pill pt-pill-neutral">{totals.plates}</span>
                                </td>

                                <td className="pt-right pt-money pt-col-money">
                                    {fmt(totals.s, true)}
                                </td>

                                <td className="pt-right pt-money pt-col-money">
                                    {fmt(totals.p, true)}
                                </td>

                                <td className="pt-right pt-money pt-col-money">
                                    {fmt(totalProfit, true)}
                                </td>

                                <td className="pt-right pt-col-profit">
                                    <span
                                        className={`pt-ratio-pill ${totalProfitability >= 0 ? "pos" : "neg"}`}
                                    >
                                        {formatPercent(totalProfitability)}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}