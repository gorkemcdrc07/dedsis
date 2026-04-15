import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./projeOperasyon.css";
import { supabase } from "../../lib/supabase";

// ======================================================
// YARDIMCI
// ======================================================

function formatCurrency(value) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    }).format(Number(value || 0));
}

function exportExcel(data, fileName, sheetName = "Sayfa1") {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

function formatDateTR(dateValue) {
    if (!dateValue) return "";
    return new Date(dateValue).toLocaleDateString("tr-TR");
}

function formatPercent(value) {
    if (value === null || value === undefined || value === "") return "";
    return `%${value}`;
}

function formatMoneyText(value) {
    return `₺${Number(value || 0).toLocaleString("tr-TR")}`;
}

function mapVehicleRow(item) {
    return {
        id: item.id,
        sira: item.sira ?? "",
        musteri: item.musteri ?? "",
        plaka: item.plaka ?? "",
        aracTelefonu: item.arac_telefonu ?? "",
        surucu: item.surucu ?? "",
        cariAdi: item.cari_adi ?? "",
        kurye: item.kurye ?? "",
        bolge: item.bolge ?? "",
        bolgeDagilim: item.bolge_dagilim ?? "",
        aracTuru: item.arac_turu ?? "",
        marka: item.marka ?? "",
        model: item.model ?? "",
        yil: item.yil ?? "",
        giydirme: item.giydirme ? "Var" : "Yok",
        sozlesme: item.sozlesme_var ? "Var" : "Yok",
        senet: item.senet_var ? "Var" : "Yok",
        senetTutari: formatMoneyText(item.senet_tutari),
        aracMetreKup: item.arac_metre_kup ?? "",
        yakitOrani: formatPercent(item.yakit_orani),
        baslangicTarihi: formatDateTR(item.baslangic_tarihi),
        satis: Number(item.satis || 0),
        maliyet: Number(item.maliyet || 0),
        vehicleImage: item.vehicle_image_url ?? null,
        licenseImage: item.license_image_url ?? null,
        note: item.note ?? "",
        dedikeBool: !!item.dedike,
        ftlBool: !!item.ftl,
    };
}

function buildSummaryRows(vehicleRows) {
    const grouped = {};

    vehicleRows.forEach((row) => {
        const musteri = row.musteri || "Bilinmeyen";

        if (!grouped[musteri]) {
            grouped[musteri] = {
                sira: 0,
                musteri,
                aracSayisi: 0,
                dedike: 0,
                ftl: 0,
                panelvan: 0,
                hKamyon: 0,
                kamyonet: 0,
                minivan: 0,
                onteker: 0,
                tir: 0,
            };
        }

        grouped[musteri].aracSayisi += 1;

        if (row.dedikeBool) grouped[musteri].dedike += 1;
        if (row.ftlBool) grouped[musteri].ftl += 1;

        if (row.aracTuru === "Panelvan") grouped[musteri].panelvan += 1;
        if (row.aracTuru === "H.Kamyon") grouped[musteri].hKamyon += 1;
        if (row.aracTuru === "Kamyonet") grouped[musteri].kamyonet += 1;
        if (row.aracTuru === "Minivan") grouped[musteri].minivan += 1;
        if (row.aracTuru === "Onteker") grouped[musteri].onteker += 1;
        if (row.aracTuru === "Tır") grouped[musteri].tir += 1;
    });

    return Object.values(grouped).map((item, index) => ({
        ...item,
        sira: index + 1,
    }));
}

function Badge({ value, variant = "default" }) {
    const cls = {
        yes: "badge badge--yes",
        no: "badge badge--no",
        region: "badge badge--region",
        info: "badge badge--info",
        warn: "badge badge--warn",
        default: "badge badge--default",
    }[variant] || "badge badge--default";

    return <span className={cls}>{value}</span>;
}

function KV({ label, value }) {
    return (
        <div className="kv">
            <span className="kv__label">{label}</span>
            <span className="kv__value">{value || "—"}</span>
        </div>
    );
}

function StatCard({ label, value, subtext, accent = false }) {
    return (
        <div className={`stat-card${accent ? " stat-card--accent" : ""}`}>
            <span className="stat-card__label">{label}</span>
            <strong className="stat-card__value">{value}</strong>
            {subtext ? <span className="stat-card__sub">{subtext}</span> : null}
        </div>
    );
}

function ImageSlot({ label, image, onUpload }) {
    const ref = React.useRef(null);

    return (
        <div className="img-slot" onClick={() => ref.current?.click()}>
            {image ? (
                <img src={image} alt={label} className="img-slot__preview" />
            ) : (
                <div className="img-slot__empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>{label}</span>
                </div>
            )}

            <input
                ref={ref}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(URL.createObjectURL(file));
                }}
            />
        </div>
    );
}

function SectionTitle({ title, desc, right }) {
    return (
        <div className="section-title">
            <div>
                <h2>{title}</h2>
                {desc ? <p>{desc}</p> : null}
            </div>
            {right ? <div>{right}</div> : null}
        </div>
    );
}

function DetailModal({ row, onClose }) {
    if (!row) return null;

    const kar = (row.satis || 0) - (row.maliyet || 0);

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal__header">
                    <div>
                        <span className="modal__plate">{row.plaka}</span>
                        <span className="modal__name">{row.surucu}</span>
                    </div>
                    <button className="modal__close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="modal__body">
                    <div className="modal__section">
                        <p className="modal__sec-title">Genel Bilgiler</p>
                        <div className="modal__grid">
                            <KV label="Müşteri" value={row.musteri} />
                            <KV label="Cari Adı" value={row.cariAdi} />
                            <KV label="Kurye" value={row.kurye} />
                            <KV label="Telefon" value={row.aracTelefonu} />
                            <KV label="Bölge" value={row.bolge} />
                            <KV label="Dağılım" value={row.bolgeDagilim} />
                        </div>
                    </div>

                    <div className="modal__section">
                        <p className="modal__sec-title">Araç Bilgileri</p>
                        <div className="modal__grid">
                            <KV label="Araç Türü" value={row.aracTuru} />
                            <KV label="Marka" value={row.marka} />
                            <KV label="Model" value={row.model} />
                            <KV label="Yıl" value={row.yil} />
                            <KV label="Hacim" value={row.aracMetreKup} />
                            <KV label="Yakıt Oranı" value={row.yakitOrani} />
                        </div>
                    </div>

                    <div className="modal__section">
                        <p className="modal__sec-title">Evrak & Finans</p>
                        <div className="modal__grid">
                            <KV label="Sözleşme" value={row.sozlesme} />
                            <KV label="Senet" value={row.senet} />
                            <KV label="Senet Tutarı" value={row.senetTutari} />
                            <KV label="Satış" value={formatCurrency(row.satis)} />
                            <KV label="Maliyet" value={formatCurrency(row.maliyet)} />
                            <KV label="Kar" value={formatCurrency(kar)} />
                        </div>
                    </div>

                    {row.note ? (
                        <div className="modal__section">
                            <p className="modal__sec-title">Not</p>
                            <p className="modal__note">{row.note}</p>
                        </div>
                    ) : null}

                    {(row.vehicleImage || row.licenseImage) && (
                        <div className="modal__section">
                            <p className="modal__sec-title">Görseller</p>
                            <div className="modal__images">
                                {row.vehicleImage && <img src={row.vehicleImage} alt="Araç" className="modal__img" />}
                                {row.licenseImage && <img src={row.licenseImage} alt="Ruhsat" className="modal__img" />}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function VehicleCard({ row, onDetail, onImageUpload, onNoteChange }) {
    const kar = (row.satis || 0) - (row.maliyet || 0);

    return (
        <div className="vcard">
            <div className="vcard__top">
                <div className="vcard__top-left">
                    <span className="vcard__plate">{row.plaka}</span>
                    <span className="vcard__musteri">{row.musteri}</span>
                </div>

                <div className="vcard__badges">
                    <Badge value={row.bolge} variant="region" />
                    <Badge value={row.giydirme} variant={row.giydirme === "Var" ? "yes" : "no"} />
                </div>
            </div>

            <div className="vcard__dagilim">{row.bolgeDagilim}</div>

            <div className="vcard__section">
                <div className="vcard__grid2">
                    <KV label="Sürücü" value={row.surucu} />
                    <KV label="Kurye" value={row.kurye} />
                    <KV label="Cari Adı" value={row.cariAdi} />
                    <KV label="Telefon" value={row.aracTelefonu} />
                </div>
            </div>

            <div className="vcard__divider" />

            <div className="vcard__section">
                <div className="vcard__grid3">
                    <KV label="Marka" value={row.marka} />
                    <KV label="Model" value={row.model} />
                    <KV label="Yıl" value={row.yil} />
                    <KV label="Tür" value={row.aracTuru} />
                    <KV label="Hacim" value={row.aracMetreKup} />
                    <KV label="Yakıt" value={row.yakitOrani} />
                </div>
            </div>

            <div className="vcard__divider" />

            <div className="vcard__chips">
                <span className="chip chip--doc">{row.sozlesme === "Var" ? "✓" : "✗"} Sözleşme</span>
                <span className="chip chip--doc">{row.senet === "Var" ? "✓" : "✗"} Senet</span>
                <span className="chip chip--money">{row.senetTutari}</span>
                <span className="chip chip--date">📅 {row.baslangicTarihi}</span>
                <span className={`chip ${kar >= 0 ? "chip--profit" : "chip--loss"}`}>Kar: {formatCurrency(kar)}</span>
            </div>

            <div className="vcard__divider" />

            <div className="vcard__images">
                <ImageSlot
                    label="Araç Görseli"
                    image={row.vehicleImage}
                    onUpload={(url) => onImageUpload(row.id, "vehicleImage", url)}
                />
                <ImageSlot
                    label="Ruhsat Görseli"
                    image={row.licenseImage}
                    onUpload={(url) => onImageUpload(row.id, "licenseImage", url)}
                />
            </div>

            <div className="vcard__note">
                <textarea
                    placeholder="Not ekle..."
                    value={row.note}
                    onChange={(e) => onNoteChange(row.id, e.target.value)}
                />
            </div>

            <div className="vcard__footer">
                <button className="btn btn--primary" onClick={() => onDetail(row)}>
                    Detay Gör
                </button>
                <button className="btn btn--ghost">Düzenle</button>
            </div>
        </div>
    );
}

function ListRow({ row, onDetail }) {
    const kar = (row.satis || 0) - (row.maliyet || 0);

    return (
        <div className="list-row">
            <span className="list-row__num">{row.sira}</span>

            <div className="list-row__main">
                <div className="list-row__top">
                    <span className="list-row__plate">{row.plaka}</span>
                    <span className="list-row__driver">{row.surucu}</span>
                    <span className="list-row__car">
                        {row.marka} {row.model} · {row.yil}
                    </span>
                </div>
                <div className="list-row__sub">
                    {row.musteri} · {row.bolgeDagilim} · Kurye: {row.kurye}
                </div>
            </div>

            <div className="list-row__meta">
                <Badge value={row.bolge} variant="region" />
                <Badge value={row.giydirme} variant={row.giydirme === "Var" ? "yes" : "no"} />
                <span className="chip chip--doc">{row.aracMetreKup}</span>
                <span className="chip chip--doc">{row.yakitOrani}</span>
                <span className={`chip ${kar >= 0 ? "chip--profit" : "chip--loss"}`}>{formatCurrency(kar)}</span>
            </div>

            <div className="list-row__actions">
                <button className="btn btn--primary btn--sm" onClick={() => onDetail(row)}>
                    Detay
                </button>
                <button className="btn btn--ghost btn--sm">Düzenle</button>
            </div>
        </div>
    );
}

function DataTable({ columns, rows, emptyText = "Kayıt bulunamadı." }) {
    if (!rows.length) {
        return <div className="po-empty">{emptyText}</div>;
    }

    return (
        <div className="table-wrap">
            <table className="modern-table">
                <thead>
                    <tr>
                        {columns.map((col) => (
                            <th key={col.key}>{col.title}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => (
                        <tr key={row.id || row.plaka || row.sira || idx}>
                            {columns.map((col) => (
                                <td key={col.key}>
                                    {typeof col.render === "function" ? col.render(row[col.key], row, idx) : row[col.key] || "—"}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ======================================================
// ANA COMPONENT
// ======================================================

export default function ProjeOperasyonSayfasi() {
    const [rows, setRows] = useState([]);
    const [summaryRows, setSummaryRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [bolge, setBolge] = useState("Tümü");
    const [view, setView] = useState("card");
    const [tab, setTab] = useState("ozet");
    const [modal, setModal] = useState(null);

    const loadAraclar = useCallback(async () => {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
            .from("araclar")
            .select("*")
            .order("sira", { ascending: true });

        if (error) {
            console.error(error);
            setError("Araç verileri alınırken hata oluştu.");
            setRows([]);
            setSummaryRows([]);
            setLoading(false);
            return;
        }

        const mappedRows = (data || []).map(mapVehicleRow);
        setRows(mappedRows);
        setSummaryRows(buildSummaryRows(mappedRows));
        setLoading(false);
    }, []);

    useEffect(() => {
        loadAraclar();
    }, [loadAraclar]);

    const filteredVehicles = useMemo(() => {
        const q = search.toLowerCase().trim();

        return rows.filter((r) => {
            const inBolge = bolge === "Tümü" || r.bolge === bolge;
            const inSearch =
                !q ||
                [
                    r.musteri,
                    r.plaka,
                    r.surucu,
                    r.cariAdi,
                    r.kurye,
                    r.bolge,
                    r.bolgeDagilim,
                    r.marka,
                    r.model,
                    r.aracTuru,
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(q);

            return inBolge && inSearch;
        });
    }, [rows, search, bolge]);

    const eksikEvrakRows = useMemo(() => {
        return rows.filter((r) => r.sozlesme === "Yok" || r.senet === "Yok");
    }, [rows]);

    const finansRows = useMemo(() => {
        return rows.map((r) => ({
            ...r,
            kar: (r.satis || 0) - (r.maliyet || 0),
        }));
    }, [rows]);

    const summaryTotals = useMemo(() => {
        return summaryRows.reduce(
            (acc, row) => {
                acc.toplam += Number(row.aracSayisi) || 0;
                acc.dedike += Number(row.dedike) || 0;
                acc.ftl += Number(row.ftl) || 0;
                acc.panelvan += Number(row.panelvan) || 0;
                acc.hKamyon += Number(row.hKamyon) || 0;
                acc.kamyonet += Number(row.kamyonet) || 0;
                acc.minivan += Number(row.minivan) || 0;
                acc.onteker += Number(row.onteker) || 0;
                acc.tir += Number(row.tir) || 0;
                return acc;
            },
            {
                toplam: 0,
                dedike: 0,
                ftl: 0,
                panelvan: 0,
                hKamyon: 0,
                kamyonet: 0,
                minivan: 0,
                onteker: 0,
                tir: 0,
            }
        );
    }, [summaryRows]);

    const totalProfit = useMemo(
        () => finansRows.reduce((sum, r) => sum + (r.kar || 0), 0),
        [finansRows]
    );

    const totalSales = useMemo(
        () => finansRows.reduce((sum, r) => sum + (r.satis || 0), 0),
        [finansRows]
    );

    const totalCost = useMemo(
        () => finansRows.reduce((sum, r) => sum + (r.maliyet || 0), 0),
        [finansRows]
    );

    const handleImageUpload = useCallback((id, field, url) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: url } : r)));
    }, []);

    const handleNoteChange = useCallback(async (id, value) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, note: value } : r)));

        const { error } = await supabase
            .from("araclar")
            .update({ note: value })
            .eq("id", id);

        if (error) {
            console.error("Not güncellenemedi:", error);
        }
    }, []);

    const exportSummaryExcel = () => {
        exportExcel(
            summaryRows.map((r) => ({
                "Sıra": r.sira,
                "Müşteri Adı": r.musteri,
                "Araç Sayısı": r.aracSayisi,
                "Dedike": r.dedike || "",
                "FTL": r.ftl || "",
                "Panelvan": r.panelvan || "",
                "H.Kamyon": r.hKamyon || "",
                "Kamyonet": r.kamyonet || "",
                "Minivan": r.minivan || "",
                "Onteker": r.onteker || "",
                "Tır": r.tir || "",
            })),
            "Operasyon_Ozet",
            "Ozet"
        );
    };

    const exportMissingDocsExcel = () => {
        exportExcel(
            eksikEvrakRows.map((r) => ({
                "Sıra": r.sira,
                "Müşteri": r.musteri,
                "Plaka": r.plaka,
                "Sürücü": r.surucu,
                "Cari Adı": r.cariAdi,
                "Araç Türü": r.aracTuru,
                "Sözleşme": r.sozlesme,
                "Senet": r.senet,
                "Senet Tutarı": r.senetTutari,
            })),
            "Eksik_Evrak_Listesi",
            "Eksik Evrak"
        );
    };

    const exportFinanceExcel = () => {
        exportExcel(
            finansRows.map((r) => ({
                "Sıra": r.sira,
                "Müşteri": r.musteri,
                "Plaka": r.plaka,
                "Araç Türü": r.aracTuru,
                "Yakıt Oranı": r.yakitOrani,
                "Satış": r.satis,
                "Maliyet": r.maliyet,
                "Kar": r.kar,
            })),
            "Satis_Maliyet_Raporu",
            "Finans"
        );
    };

    const summaryColumns = [
        { key: "sira", title: "Sıra" },
        { key: "musteri", title: "Müşteri Adı" },
        { key: "aracSayisi", title: "Araç Sayısı" },
        { key: "dedike", title: "Dedike" },
        { key: "ftl", title: "FTL" },
        { key: "panelvan", title: "Panelvan" },
        { key: "hKamyon", title: "H.Kamyon" },
        { key: "kamyonet", title: "Kamyonet" },
        { key: "minivan", title: "Minivan" },
        { key: "onteker", title: "Onteker" },
        { key: "tir", title: "Tır" },
    ];

    const missingDocsColumns = [
        { key: "sira", title: "Sıra" },
        { key: "musteri", title: "Müşteri" },
        { key: "plaka", title: "Plaka" },
        { key: "surucu", title: "Sürücü" },
        { key: "cariAdi", title: "Cari Adı" },
        { key: "aracTuru", title: "Araç Türü" },
        {
            key: "sozlesme",
            title: "Sözleşme",
            render: (value) => <Badge value={value} variant={value === "Var" ? "yes" : "no"} />,
        },
        {
            key: "senet",
            title: "Senet",
            render: (value) => <Badge value={value} variant={value === "Var" ? "yes" : "no"} />,
        },
        { key: "senetTutari", title: "Senet Tutarı" },
    ];

    const financeColumns = [
        { key: "sira", title: "Sıra" },
        { key: "musteri", title: "Müşteri" },
        { key: "plaka", title: "Plaka" },
        { key: "aracTuru", title: "Araç Türü" },
        { key: "yakitOrani", title: "Yakıt Oranı" },
        {
            key: "satis",
            title: "Satış",
            render: (value) => formatCurrency(value),
        },
        {
            key: "maliyet",
            title: "Maliyet",
            render: (value) => formatCurrency(value),
        },
        {
            key: "kar",
            title: "Kar",
            render: (value) => (
                <span className={value >= 0 ? "text-profit" : "text-loss"}>
                    {formatCurrency(value)}
                </span>
            ),
        },
    ];

    if (loading) {
        return (
            <div className="po-page">
                <div className="po-empty">Araç verileri yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="po-page">
            <div className="hero-panel">
                <div>
                    <p className="po-suptitle">Yönetim Paneli</p>
                    <h1 className="po-title">Operasyon, Evrak ve Finans Yönetimi</h1>
                    <p className="po-desc">
                        Tüm tablolar tek ekranda, modern görünümde, filtrelenebilir ve Excel çıktılı şekilde yönetilir.
                    </p>
                </div>

                <div className="hero-actions">
                    <button className="btn btn--ghost" onClick={exportSummaryExcel}>
                        Özet Excel
                    </button>
                    <button className="btn btn--ghost" onClick={exportMissingDocsExcel}>
                        Evrak Excel
                    </button>
                    <button className="btn btn--primary" onClick={exportFinanceExcel}>
                        Finans Excel
                    </button>
                </div>
            </div>

            {error && <div className="po-empty">{error}</div>}

            <div className="po-stats">
                <StatCard label="Toplam Araç" value={summaryTotals.toplam} subtext="Özet veriden" accent />
                <StatCard label="Dedike" value={summaryTotals.dedike} subtext="Aktif dedike araç" />
                <StatCard label="FTL" value={summaryTotals.ftl} subtext="FTL toplamı" />
                <StatCard label="Eksik Evrak" value={eksikEvrakRows.length} subtext="Sözleşme veya senet eksik" />
                <StatCard label="Toplam Satış" value={formatCurrency(totalSales)} subtext="Finans verisi" />
                <StatCard label="Toplam Maliyet" value={formatCurrency(totalCost)} subtext="Finans verisi" />
                <StatCard label="Toplam Kar" value={formatCurrency(totalProfit)} subtext="Satış - maliyet" />
                <StatCard label="Panelvan" value={summaryTotals.panelvan} subtext="Araç türü kırılımı" />
            </div>

            <div className="tabs">
                <button
                    className={`tabs__btn ${tab === "ozet" ? "tabs__btn--active" : ""}`}
                    onClick={() => setTab("ozet")}
                >
                    Özet
                </button>
                <button
                    className={`tabs__btn ${tab === "araclar" ? "tabs__btn--active" : ""}`}
                    onClick={() => setTab("araclar")}
                >
                    Araç Kartları
                </button>
                <button
                    className={`tabs__btn ${tab === "evrak" ? "tabs__btn--active" : ""}`}
                    onClick={() => setTab("evrak")}
                >
                    Eksik Evrak
                </button>
                <button
                    className={`tabs__btn ${tab === "finans" ? "tabs__btn--active" : ""}`}
                    onClick={() => setTab("finans")}
                >
                    Satış & Maliyet
                </button>
            </div>

            {tab === "ozet" && (
                <>
                    <SectionTitle
                        title="Operasyon Özeti"
                        desc="Araçlar tablosundan otomatik oluşturulan özet tablo"
                        right={
                            <button className="btn btn--ghost" onClick={exportSummaryExcel}>
                                Excel Aktar
                            </button>
                        }
                    />

                    <div className="summary-mini-grid">
                        <StatCard label="Panelvan" value={summaryTotals.panelvan} />
                        <StatCard label="H.Kamyon" value={summaryTotals.hKamyon} />
                        <StatCard label="Kamyonet" value={summaryTotals.kamyonet} />
                        <StatCard label="Minivan" value={summaryTotals.minivan} />
                        <StatCard label="Onteker" value={summaryTotals.onteker} />
                        <StatCard label="Tır" value={summaryTotals.tir} />
                    </div>

                    <DataTable columns={summaryColumns} rows={summaryRows} emptyText="Özet veri bulunamadı." />
                </>
            )}

            {tab === "araclar" && (
                <>
                    <SectionTitle
                        title="Araç Yönetim Alanı"
                        desc="Kart görünümü ve tablo görünümü arasında geçiş yapabilirsiniz."
                        right={
                            <div className="toolbar-right">
                                <div className="view-toggle">
                                    <button
                                        className={`view-toggle__btn${view === "card" ? " view-toggle__btn--active" : ""}`}
                                        onClick={() => setView("card")}
                                        title="Kart görünümü"
                                    >
                                        ▦
                                    </button>
                                    <button
                                        className={`view-toggle__btn${view === "list" ? " view-toggle__btn--active" : ""}`}
                                        onClick={() => setView("list")}
                                        title="Liste görünümü"
                                    >
                                        ☰
                                    </button>
                                </div>
                            </div>
                        }
                    />

                    <div className="po-toolbar">
                        <div className="search-wrap">
                            <svg className="search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Plaka, sürücü, müşteri, bölge ara..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <div className="segment">
                            {["Tümü", "Avrupa", "Anadolu", "Bursa", "Trakya"].map((b) => (
                                <button
                                    key={b}
                                    className={`segment__btn${bolge === b ? " segment__btn--active" : ""}`}
                                    onClick={() => setBolge(b)}
                                >
                                    {b}
                                </button>
                            ))}
                        </div>

                        <button
                            className="btn btn--ghost"
                            onClick={() =>
                                exportExcel(
                                    filteredVehicles.map((r) => ({
                                        "Sıra": r.sira,
                                        "Müşteri": r.musteri,
                                        "Plaka": r.plaka,
                                        "Sürücü": r.surucu,
                                        "Cari Adı": r.cariAdi,
                                        "Kurye": r.kurye,
                                        "Bölge": r.bolge,
                                        "Bölge Dağılım": r.bolgeDagilim,
                                        "Araç Türü": r.aracTuru,
                                        "Marka": r.marka,
                                        "Model": r.model,
                                        "Yıl": r.yil,
                                        "Sözleşme": r.sozlesme,
                                        "Senet": r.senet,
                                        "Satış": r.satis,
                                        "Maliyet": r.maliyet,
                                    })),
                                    "Arac_Yonetim_Listesi",
                                    "Araçlar"
                                )
                            }
                        >
                            Filtreli Excel
                        </button>
                    </div>

                    {search || bolge !== "Tümü" ? (
                        <p className="po-result-count">{filteredVehicles.length} kayıt bulundu</p>
                    ) : null}

                    {filteredVehicles.length === 0 ? (
                        <div className="po-empty">Arama kriterine uygun kayıt bulunamadı.</div>
                    ) : view === "card" ? (
                        <div className="card-grid">
                            {filteredVehicles.map((row) => (
                                <VehicleCard
                                    key={row.id}
                                    row={row}
                                    onDetail={setModal}
                                    onImageUpload={handleImageUpload}
                                    onNoteChange={handleNoteChange}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="list-view">
                            {filteredVehicles.map((row) => (
                                <ListRow key={row.id} row={row} onDetail={setModal} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {tab === "evrak" && (
                <>
                    <SectionTitle
                        title="Sözleşme / Senet Mevcut Olmayanlar"
                        desc="Araçlar tablosundan filtrelenen eksik evrak listesi"
                        right={
                            <button className="btn btn--ghost" onClick={exportMissingDocsExcel}>
                                Excel Aktar
                            </button>
                        }
                    />

                    <DataTable
                        columns={missingDocsColumns}
                        rows={eksikEvrakRows}
                        emptyText="Eksik evrak kaydı bulunamadı."
                    />
                </>
            )}

            {tab === "finans" && (
                <>
                    <SectionTitle
                        title="Satış & Maliyet Raporu"
                        desc="Araçlar tablosundan üretilen finans tablosu"
                        right={
                            <button className="btn btn--ghost" onClick={exportFinanceExcel}>
                                Excel Aktar
                            </button>
                        }
                    />

                    <div className="finance-summary">
                        <div className="finance-summary__item">
                            <span>Toplam Satış</span>
                            <strong>{formatCurrency(totalSales)}</strong>
                        </div>
                        <div className="finance-summary__item">
                            <span>Toplam Maliyet</span>
                            <strong>{formatCurrency(totalCost)}</strong>
                        </div>
                        <div className="finance-summary__item finance-summary__item--profit">
                            <span>Toplam Kar</span>
                            <strong>{formatCurrency(totalProfit)}</strong>
                        </div>
                    </div>

                    <DataTable columns={financeColumns} rows={finansRows} />
                </>
            )}

            <DetailModal row={modal} onClose={() => setModal(null)} />
        </div>
    );
}