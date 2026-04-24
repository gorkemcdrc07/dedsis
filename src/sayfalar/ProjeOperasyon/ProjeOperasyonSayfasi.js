import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./projeOperasyon.css";
import { supabase } from "../../lib/supabase";

const STORAGE_BUCKET = "arac-gorseller";

// ─── FORMAT HELPERS ───────────────────────────────────────────────────────────
function fCurrency(v) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
    }).format(Number(v || 0));
}

function fDate(v) {
    return v ? new Date(v).toLocaleDateString("tr-TR") : "—";
}

function fPct(v) {
    const n = Number(v);
    return Number.isFinite(n) && v !== "" && v != null ? `%${n}` : "—";
}

function fMoney(v) {
    return `₺${Number(v || 0).toLocaleString("tr-TR")}`;
}

function exportXLSX(data, fileName, sheet = "Sayfa1") {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
}

// ─── SAFE KEY HELPERS ─────────────────────────────────────────────────────────
function makeRowKey(row, index = 0) {
    return [row?.id ?? "noid", row?.plaka ?? "noplate", row?.musteri ?? "nocustomer", index].join("__");
}

function makeSummaryKey(row, index = 0) {
    return [row?.musteri ?? "Bilinmeyen", index].join("__");
}

function warnDuplicateIds(rows) {
    const counts = new Map();

    rows.forEach((row) => {
        const id = row?.id;
        if (id == null) return;
        counts.set(id, (counts.get(id) || 0) + 1);
    });

    const duplicates = [...counts.entries()].filter(([, count]) => count > 1);

    if (duplicates.length > 0) {
        console.warn(
            "Duplicate row.id bulundu:",
            duplicates.map(([id, count]) => ({ id, count }))
        );
    }
}

function getStoragePathFromUrl(fileUrl, bucketName = STORAGE_BUCKET) {
    if (!fileUrl) return null;

    try {
        const url = new URL(fileUrl);
        const marker = `/storage/v1/object/public/${bucketName}/`;
        const idx = url.pathname.indexOf(marker);

        if (idx === -1) return null;

        return decodeURIComponent(url.pathname.slice(idx + marker.length));
    } catch (error) {
        console.error("Storage path parse hatası:", error);
        return null;
    }
}

// ─── IMAGE HELPERS ────────────────────────────────────────────────────────────
function groupImagesByVehicle(imageRows = []) {
    const grouped = new Map();

    imageRows.forEach((img) => {
        const aracId = img.arac_id;
        if (!aracId) return;

        if (!grouped.has(aracId)) {
            grouped.set(aracId, {
                arac: [],
                ruhsat: [],
                police: [],
                ehliyet_ruhsat: [],
            });
        }

        const current = grouped.get(aracId);
        const type = String(img.gorsel_tipi || "").trim();

        if (!current[type]) current[type] = [];

        current[type].push({
            id: img.id,
            arac_id: img.arac_id,
            gorsel_url: img.gorsel_url,
            gorsel_tipi: img.gorsel_tipi,
            sira: img.sira ?? 1,
            created_at: img.created_at ?? null,
        });
    });

    grouped.forEach((value) => {
        Object.keys(value).forEach((key) => {
            value[key] = [...value[key]].sort((a, b) => Number(a.sira || 0) - Number(b.sira || 0));
        });
    });

    return grouped;
}

// ─── SUMMARY HELPERS ──────────────────────────────────────────────────────────
function normalizeVehicleType(value) {
    const t = String(value || "").trim().toLocaleLowerCase("tr-TR");

    if (!t) return "";

    if (t.includes("panel")) return "Panelvan";
    if (t.includes("h.kamyon") || t.includes("h kamyon") || t.includes("hafif kamyon")) return "H.Kamyon";
    if (t.includes("kamyonet")) return "Kamyonet";
    if (t.includes("minivan")) return "Minivan";
    if (t.includes("önteker") || t.includes("onteker")) return "Onteker";
    if (t.includes("tır") || t.includes("tir")) return "Tır";

    return value;
}

function normalizeOperationType(row) {
    const raw = [
        row?.operasyonTuru,
        row?.operasyon_turu,
        row?.islemTuru,
        row?.islem_turu,
        row?.projeTipi,
        row?.proje_tipi,
        row?.tasimaTipi,
        row?.tasima_tipi,
        row?.calismaTipi,
        row?.calisma_tipi,
        row?.hatTipi,
        row?.hat_tipi,
    ].find((v) => v !== undefined && v !== null && String(v).trim() !== "");

    if (raw) {
        const v = String(raw).trim().toLocaleLowerCase("tr-TR");
        if (v.includes("ftl")) return "Ftl";
        if (v.includes("dedike")) return "Dedike";
    }

    const joined = [row?.musteri, row?.cariAdi, row?.kurye, row?.bolgeDagilim]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR");

    if (joined.includes("ftl")) return "Ftl";
    if (joined.includes("dedike")) return "Dedike";

    return "Dedike";
}

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
function mapRow(item, vehicleImages = {}) {
    const aracImages = vehicleImages.arac || [];
    const ruhsatImages = vehicleImages.ruhsat || [];
    const policeImages = vehicleImages.police || [];
    const ehliyetRuhsatImages = vehicleImages.ehliyet_ruhsat || [];

    return {
        id: item.id,
        musteri: item.musteri ?? "",
        plaka: item.plaka ?? "",
        aracTelefonu: item.arac_telefonu ?? "",
        surucu: item.surucu ?? "",
        cariAdi: item.cari_adi ?? "",
        kurye: item.kurye ?? "",
        bolge: item.bolge ?? "",
        bolgeDagilim: item.bolge_dagilim ?? "",
        aracTuru: normalizeVehicleType(item.arac_turu ?? ""),
        operasyonTuru: normalizeOperationType({
            operasyonTuru: item.operasyon_turu,
            operasyon_turu: item.operasyon_turu,
            islemTuru: item.islem_turu,
            islem_turu: item.islem_turu,
            projeTipi: item.proje_tipi,
            proje_tipi: item.proje_tipi,
            tasimaTipi: item.tasima_tipi,
            tasima_tipi: item.tasima_tipi,
            calismaTipi: item.calisma_tipi,
            calisma_tipi: item.calisma_tipi,
            hatTipi: item.hat_tipi,
            hat_tipi: item.hat_tipi,
            musteri: item.musteri,
            cariAdi: item.cari_adi,
            kurye: item.kurye,
            bolgeDagilim: item.bolge_dagilim,
        }),
        marka: item.marka ?? "",
        model: item.model ?? "",
        yil: item.yil ?? "",
        giydirme: item.giydirme ? "Var" : "Yok",
        sozlesme: item.sozlesme ? "Var" : "Yok",
        senet: item.senet ? "Var" : "Yok",
        senetTutari: fMoney(item.senet_tutari),
        aracMetreKup: item.arac_metre_kup ?? "",
        yakitOrani: fPct(item.yakit_orani),
        yakitOraniSatis: fPct(item.yakit_orani_satis),
        yakitOraniMaliyet: fPct(item.yakit_orani_maliyet),
        baslangicTarihi: item.baslangic_tarihi ?? "",
        baslangicTarihiText: fDate(item.baslangic_tarihi),
        satis: Number(item.satis || 0),
        maliyet: Number(item.maliyet || 0),

        aracGorseller: aracImages,
        ruhsatGorseller: ruhsatImages,
        policeGorseller: policeImages,
        ehliyetRuhsatGorseller: ehliyetRuhsatImages,

        vehicleImage: aracImages[0]?.gorsel_url ?? null,
        licenseImage: ruhsatImages[0]?.gorsel_url ?? null,
    };
}

function buildSummary(rows) {
    const grouped = {};

    rows.forEach((r) => {
        const musteri = r.musteri || "Bilinmeyen";
        const aracTuru = normalizeVehicleType(r.aracTuru);
        const operasyonTuru = normalizeOperationType(r);

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

        if (operasyonTuru === "Ftl") grouped[musteri].ftl += 1;
        else grouped[musteri].dedike += 1;

        if (aracTuru === "Panelvan") grouped[musteri].panelvan += 1;
        if (aracTuru === "H.Kamyon") grouped[musteri].hKamyon += 1;
        if (aracTuru === "Kamyonet") grouped[musteri].kamyonet += 1;
        if (aracTuru === "Minivan") grouped[musteri].minivan += 1;
        if (aracTuru === "Onteker") grouped[musteri].onteker += 1;
        if (aracTuru === "Tır") grouped[musteri].tir += 1;
    });

    const summaryRows = Object.values(grouped)
        .sort((a, b) => a.musteri.localeCompare(b.musteri, "tr"))
        .map((item, index) => ({
            ...item,
            sira: index + 1,
        }));

    const totals = summaryRows.reduce(
        (acc, row) => {
            acc.aracSayisi += row.aracSayisi;
            acc.dedike += row.dedike;
            acc.ftl += row.ftl;
            acc.panelvan += row.panelvan;
            acc.hKamyon += row.hKamyon;
            acc.kamyonet += row.kamyonet;
            acc.minivan += row.minivan;
            acc.onteker += row.onteker;
            acc.tir += row.tir;
            return acc;
        },
        {
            sira: "",
            musteri: "Toplamlar",
            aracSayisi: 0,
            dedike: 0,
            ftl: 0,
            panelvan: 0,
            hKamyon: 0,
            kamyonet: 0,
            minivan: 0,
            onteker: 0,
            tir: 0,
            isTotal: true,
        }
    );

    return { rows: summaryRows, totals };
}

// ─── FEEDBACK UI ──────────────────────────────────────────────────────────────
function ToastCenter({ items, onClose }) {
    useEffect(() => {
        if (!items.length) return;

        const timers = items.map((item) =>
            setTimeout(() => onClose(item.id), item.duration || 3200)
        );

        return () => timers.forEach(clearTimeout);
    }, [items, onClose]);

    return (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
            {items.map((item) => (
                <div key={item.id} className={`toast toast--${item.type || "info"}`}>
                    <div className="toast__icon">
                        {item.type === "success" ? "✓" : item.type === "error" ? "!" : "i"}
                    </div>

                    <div className="toast__content">
                        <div className="toast__title">{item.title || "Bilgi"}</div>
                        {item.message ? <div className="toast__message">{item.message}</div> : null}
                    </div>

                    <button type="button" className="toast__close" onClick={() => onClose(item.id)}>
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
}

function ConfirmModal({
    open,
    title = "Onay gerekli",
    message = "Bu işlemi yapmak istediğinize emin misiniz?",
    confirmText = "Onayla",
    cancelText = "Vazgeç",
    tone = "danger",
    loading = false,
    onConfirm,
    onClose,
}) {
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape" && !loading) onClose?.();
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose, loading]);

    if (!open) return null;

    return (
        <>
            <div className="confirm-backdrop" onClick={() => !loading && onClose?.()} />
            <div className="confirm-modal" role="dialog" aria-modal="true" aria-label={title}>
                <div className={`confirm-modal__badge confirm-modal__badge--${tone}`}>
                    {tone === "danger" ? "!" : "i"}
                </div>

                <div className="confirm-modal__title">{title}</div>
                <div className="confirm-modal__message">{message}</div>

                <div className="confirm-modal__actions">
                    <button
                        type="button"
                        className="confirm-btn confirm-btn--ghost"
                        onClick={onClose}
                        disabled={loading}
                    >
                        {cancelText}
                    </button>

                    <button
                        type="button"
                        className={`confirm-btn confirm-btn--${tone}`}
                        onClick={onConfirm}
                        disabled={loading}
                    >
                        {loading ? "İşleniyor..." : confirmText}
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── SMALL UI ATOMS ───────────────────────────────────────────────────────────
function DocPill({ label, ok }) {
    return (
        <span className={`doc-pill ${ok ? "doc-pill--ok" : "doc-pill--missing"}`}>
            {ok ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3 3L7 7M7 3L3 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
            )}
            {label}
        </span>
    );
}

function TypeBadge({ type }) {
    const colors = {
        Panelvan: "badge-blue",
        "H.Kamyon": "badge-orange",
        Kamyonet: "badge-teal",
        Minivan: "badge-purple",
        Onteker: "badge-red",
        Tır: "badge-gray",
    };

    return <span className={`type-badge ${colors[type] || "badge-gray"}`}>{type || "—"}</span>;
}

function KarPill({ kar }) {
    return (
        <span className={`kar-pill ${kar >= 0 ? "kar-pill--pos" : "kar-pill--neg"}`}>
            {fCurrency(kar)}
        </span>
    );
}

// ─── IMAGE COMPONENTS ─────────────────────────────────────────────────────────
function SingleImageUploader({ label, image, onUpload, icon }) {
    const ref = useRef(null);

    return (
        <div className="img-uploader" onClick={() => ref.current?.click()}>
            {image ? (
                <>
                    <img src={image} alt={label} className="img-uploader__img" />
                    <div className="img-uploader__overlay">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="M10 3V17M3 10H17" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <span>Değiştir</span>
                    </div>
                </>
            ) : (
                <div className="img-uploader__empty">
                    {icon}
                    <span className="img-uploader__label">{label}</span>
                    <span className="img-uploader__hint">Tıkla</span>
                </div>
            )}

            <input
                ref={ref}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(file);
                    e.target.value = "";
                }}
            />
        </div>
    );
}

function ImageGallery({ title, images = [] }) {
    if (!images.length) return null;

    return (
        <div className="dp-gallery">
            <div className="dp-note-label">{title}</div>
            <div className="img-grid">
                {images.map((img, index) => (
                    <a
                        key={img.id || `${img.gorsel_url}-${index}`}
                        href={img.gorsel_url}
                        target="_blank"
                        rel="noreferrer"
                        className="img-uploader"
                    >
                        <img src={img.gorsel_url} alt={`${title} ${index + 1}`} className="img-uploader__img" />
                    </a>
                ))}
            </div>
        </div>
    );
}

// ─── FORM INPUT HELPERS ───────────────────────────────────────────────────────
function FGroup({ label, children }) {
    return (
        <div className="fg">
            <label className="fg__label">{label}</label>
            {children}
        </div>
    );
}

function FInput(props) {
    return <input className="fg__input" {...props} />;
}

function FSelect({ options, ...props }) {
    return (
        <select className="fg__input" {...props}>
            <option value="">Seç...</option>
            {options.map((o) => (
                <option key={o} value={o}>
                    {o}
                </option>
            ))}
        </select>
    );
}

// ─── EMPTY FORM ───────────────────────────────────────────────────────────────
const EMPTY_FORM = {
    musteri: "",
    plaka: "",
    aracTelefonu: "",
    surucu: "",
    cariAdi: "",
    kurye: "",
    bolge: "",
    bolgeDagilim: "",
    aracTuru: "",
    marka: "",
    model: "",
    yil: "",
    giydirme: false,
    sozlesme: false,
    senet: false,
    senetTutari: "",
    aracMetreKup: "",
    yakitOrani: "",
    yakitOraniSatis: "",
    yakitOraniMaliyet: "",
    baslangicTarihi: "",
    satis: "",
    maliyet: "",
};

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
function DetailModal({ row, open, onClose, onEdit }) {
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose]);

    if (!open || !row) return null;

    const kar = (row.satis || 0) - (row.maliyet || 0);
    const gallery = row.aracGorseller || [];
    const hero = gallery[0]?.gorsel_url || null;
    const thumbs = gallery.slice(1, 4);

    return (
        <>
            <div className="center-modal-backdrop" onClick={onClose} />
            <div className="center-modal" role="dialog" aria-modal="true" aria-label={`${row.plaka} araç detayları`}>
                <div className="center-modal__header">
                    <div className="center-modal__title-wrap">
                        <div className="center-modal__eyebrow">Araç Detayı</div>

                        <div className="center-modal__title-row">
                            <div className="center-modal__plate">{row.plaka}</div>
                            <TypeBadge type={row.aracTuru} />
                        </div>

                        <div className="center-modal__sub">
                            {row.surucu || "Sürücü yok"} • {row.musteri || "Müşteri yok"}
                        </div>
                    </div>

                    <div className="center-modal__actions">
                        <button className="icon-btn" onClick={() => onEdit(row)} title="Düzenle">
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                <path
                                    d="M10 1.5L13.5 5L5 13.5H1.5V10L10 1.5Z"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </button>

                        <button className="icon-btn icon-btn--close" onClick={onClose} title="Kapat">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="center-modal__body">
                    <div className="center-modal__hero">
                        <div className="center-modal__gallery-main">
                            {hero ? (
                                <img src={hero} alt={row.plaka} className="center-modal__hero-image" />
                            ) : (
                                <div className="center-modal__hero-empty">Araç görseli yok</div>
                            )}
                        </div>

                        <div className="center-modal__gallery-side">
                            {thumbs.length > 0 ? (
                                thumbs.map((img, index) => (
                                    <a
                                        key={img.id || `${img.gorsel_url}-${index}`}
                                        href={img.gorsel_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="center-modal__thumb"
                                    >
                                        <img src={img.gorsel_url} alt={`${row.plaka} ${index + 2}`} />
                                    </a>
                                ))
                            ) : (
                                <div className="center-modal__thumb center-modal__thumb--empty">Ek görsel yok</div>
                            )}
                        </div>
                    </div>

                    <div className="center-modal__content-grid">
                        <div className="center-modal__left">
                            <div className="cm-card">
                                <div className="cm-card__title">Finans Özeti</div>

                                <div className="cm-finans-grid">
                                    <div className="dp-fin-item">
                                        <span>Satış</span>
                                        <strong>{fCurrency(row.satis)}</strong>
                                    </div>

                                    <div className="dp-fin-item">
                                        <span>Maliyet</span>
                                        <strong>{fCurrency(row.maliyet)}</strong>
                                    </div>

                                    <div className={`dp-fin-item ${kar >= 0 ? "dp-fin-item--pos" : "dp-fin-item--neg"}`}>
                                        <span>Kâr</span>
                                        <strong>{fCurrency(kar)}</strong>
                                    </div>
                                </div>
                            </div>

                            <div className="cm-card">
                                <div className="cm-card__title">Evrak Durumu</div>
                                <div className="dp-docs">
                                    <DocPill label="Giydirme" ok={row.giydirme === "Var"} />
                                    <DocPill label="Sözleşme" ok={row.sozlesme === "Var"} />
                                    <DocPill label="Senet" ok={row.senet === "Var"} />
                                </div>
                            </div>

                            <div className="cm-card">
                                <div className="cm-card__title">Belgeler</div>
                                <ImageGallery title="Ruhsat" images={row.ruhsatGorseller} />
                                <ImageGallery title="Poliçe" images={row.policeGorseller} />
                                <ImageGallery title="Ehliyet / Ruhsat" images={row.ehliyetRuhsatGorseller} />
                            </div>
                        </div>

                        <div className="center-modal__right">
                            <div className="cm-card">
                                <div className="cm-card__title">Araç Bilgileri</div>

                                <div className="dp-info-grid">
                                    {[
                                        ["Müşteri", row.musteri],
                                        ["Cari Adı", row.cariAdi],
                                        ["Kurye", row.kurye],
                                        ["Sürücü", row.surucu],
                                        ["Telefon", row.aracTelefonu],
                                        ["Bölge", row.bolge],
                                        ["Dağılım", row.bolgeDagilim],
                                        ["Operasyon Türü", row.operasyonTuru],
                                        ["Marka", row.marka],
                                        ["Model", row.model],
                                        ["Yıl", row.yil],
                                        ["Tür", row.aracTuru],
                                        ["Hacim", row.aracMetreKup],
                                        ["Yakıt", row.yakitOrani],
                                        ["Yakıt Satış", row.yakitOraniSatis],
                                        ["Yakıt Maliyet", row.yakitOraniMaliyet],
                                        ["Senet Tutarı", row.senetTutari],
                                        ["Başlangıç", row.baslangicTarihiText || row.baslangicTarihi],
                                    ].map(([k, v]) => (
                                        <div key={k} className="dp-info-row">
                                            <span className="dp-info-label">{k}</span>
                                            <span className="dp-info-val">{v || "—"}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── EDIT MODAL ───────────────────────────────────────────────────────────────
function EditModal({ open, row, onClose, onSave, onDeleteImage }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const [pendingVehicleImages, setPendingVehicleImages] = useState([]);
    const [pendingDocs, setPendingDocs] = useState({
        ruhsat: null,
        police: null,
        ehliyet_ruhsat: null,
    });

    useEffect(() => {
        if (!open) return;

        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose?.();
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open, onClose]);

    useEffect(() => {
        if (row) {
            setForm({
                musteri: row.musteri || "",
                plaka: row.plaka || "",
                aracTelefonu: row.aracTelefonu || "",
                surucu: row.surucu || "",
                cariAdi: row.cariAdi || "",
                kurye: row.kurye || "",
                bolge: row.bolge || "",
                bolgeDagilim: row.bolgeDagilim || "",
                aracTuru: row.aracTuru || "",
                marka: row.marka || "",
                model: row.model || "",
                yil: row.yil || "",
                giydirme: row.giydirme === "Var",
                sozlesme: row.sozlesme === "Var",
                senet: row.senet === "Var",
                senetTutari: String(row.senetTutari || "").replace("₺", "").replace(/\./g, ""),
                aracMetreKup: row.aracMetreKup || "",
                yakitOrani: String(row.yakitOrani || "").replace("%", ""),
                yakitOraniSatis: String(row.yakitOraniSatis || "").replace("%", ""),
                yakitOraniMaliyet: String(row.yakitOraniMaliyet || "").replace("%", ""),
                baslangicTarihi: row.baslangicTarihi || "",
                satis: row.satis || "",
                maliyet: row.maliyet || "",
            });
        } else {
            setForm(EMPTY_FORM);
        }

        setPendingVehicleImages([]);
        setPendingDocs({
            ruhsat: null,
            police: null,
            ehliyet_ruhsat: null,
        });
    }, [row, open]);

    useEffect(() => {
        return () => {
            pendingVehicleImages.forEach((img) => {
                if (img.preview) URL.revokeObjectURL(img.preview);
            });
            Object.values(pendingDocs).forEach((doc) => {
                if (doc?.preview) URL.revokeObjectURL(doc.preview);
            });
        };
    }, [pendingVehicleImages, pendingDocs]);

    const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const addPendingVehicleImage = (file) => {
        setPendingVehicleImages((prev) => {
            if (prev.length >= 4) return prev;
            return [
                ...prev,
                {
                    file,
                    preview: URL.createObjectURL(file),
                    tempId: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                },
            ];
        });
    };

    const removePendingVehicleImage = (tempId) => {
        setPendingVehicleImages((prev) => {
            const found = prev.find((x) => x.tempId === tempId);
            if (found?.preview) URL.revokeObjectURL(found.preview);
            return prev.filter((x) => x.tempId !== tempId);
        });
    };

    const setPendingDoc = (type, file) => {
        setPendingDocs((prev) => {
            if (prev[type]?.preview) URL.revokeObjectURL(prev[type].preview);
            return {
                ...prev,
                [type]: {
                    file,
                    preview: URL.createObjectURL(file),
                },
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(
                { ...form, id: row?.id },
                {
                    vehicleImages: pendingVehicleImages.map((x) => x.file),
                    docs: {
                        ruhsat: pendingDocs.ruhsat?.file || null,
                        police: pendingDocs.police?.file || null,
                        ehliyet_ruhsat: pendingDocs.ehliyet_ruhsat?.file || null,
                    },
                }
            );
            onClose();
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const existingVehicleImages = row?.aracGorseller || [];
    const existingCount = existingVehicleImages.length;
    const totalCount = existingCount + pendingVehicleImages.length;
    const canAddMore = totalCount < 4;

    return (
        <>
            <div className="center-modal-backdrop" onClick={onClose} />

            <div
                className="center-modal center-modal--edit"
                role="dialog"
                aria-modal="true"
                aria-label={row ? "Araç düzenle" : "Yeni araç ekle"}
            >
                <div className="center-modal__header">
                    <div className="center-modal__title-wrap">
                        <div className="center-modal__eyebrow">{row ? "Araç Düzenle" : "Yeni Araç"}</div>

                        <div className="center-modal__title-row">
                            <div className="center-modal__plate">{form.plaka || "Yeni Araç"}</div>
                            {form.aracTuru ? <TypeBadge type={form.aracTuru} /> : null}
                        </div>

                        <div className="center-modal__sub">
                            Tüm araç bilgilerini, evrakları ve görselleri tek ekrandan yönet
                        </div>
                    </div>

                    <div className="center-modal__actions">
                        <button className="icon-btn icon-btn--close" onClick={onClose} title="Kapat">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="center-modal__body">
                    <div className="cm-card">
                        <div className="modal-section-title">Araç Görselleri ({totalCount}/4)</div>

                        <div className="img-grid">
                            {existingVehicleImages.map((img, index) => (
                                <div key={img.id || `${img.gorsel_url}-${index}`} className="img-uploader">
                                    <img src={img.gorsel_url} alt={`Araç ${index + 1}`} className="img-uploader__img" />
                                    <div className="img-uploader__overlay" style={{ opacity: 1 }}>
                                        <button
                                            type="button"
                                            className="icon-btn icon-btn--close"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteImage?.(img);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {pendingVehicleImages.map((img) => (
                                <div key={img.tempId} className="img-uploader">
                                    <img src={img.preview} alt="Yeni görsel" className="img-uploader__img" />
                                    <div className="img-uploader__overlay" style={{ opacity: 1 }}>
                                        <button
                                            type="button"
                                            className="icon-btn icon-btn--close"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                removePendingVehicleImage(img.tempId);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {canAddMore && (
                                <SingleImageUploader
                                    label="Araç Görseli Ekle"
                                    image={null}
                                    onUpload={addPendingVehicleImage}
                                    icon={
                                        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                            <path d="M14 6V22M6 14H22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                        </svg>
                                    }
                                />
                            )}
                        </div>
                    </div>

                    <div className="cm-card">
                        <div className="modal-section-title">Belgeler</div>

                        <div className="img-pair">
                            <SingleImageUploader
                                label="Ruhsat"
                                image={pendingDocs.ruhsat?.preview || row?.ruhsatGorseller?.[0]?.gorsel_url || null}
                                onUpload={(file) => setPendingDoc("ruhsat", file)}
                                icon={
                                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                        <rect x="5" y="2" width="18" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
                                        <path d="M9 8H19M9 12H19M9 16H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                }
                            />

                            <SingleImageUploader
                                label="Poliçe"
                                image={pendingDocs.police?.preview || row?.policeGorseller?.[0]?.gorsel_url || null}
                                onUpload={(file) => setPendingDoc("police", file)}
                                icon={
                                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                        <rect x="4" y="4" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" />
                                        <path d="M9 14H19M9 10H16M9 18H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                }
                            />
                        </div>

                        <div className="edit-doc-single">
                            <SingleImageUploader
                                label="Ehliyet / Ruhsat"
                                image={pendingDocs.ehliyet_ruhsat?.preview || row?.ehliyetRuhsatGorseller?.[0]?.gorsel_url || null}
                                onUpload={(file) => setPendingDoc("ehliyet_ruhsat", file)}
                                icon={
                                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                        <rect x="3" y="5" width="22" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" />
                                        <circle cx="10" cy="14" r="3" stroke="currentColor" strokeWidth="1.5" />
                                        <path d="M16 11H21M16 15H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                }
                            />
                        </div>
                    </div>

                    <div className="edit-grid">
                        <div className="cm-card">
                            <div className="modal-section-title">Genel Bilgiler</div>

                            <div className="fg-grid fg-grid--2">
                                <FGroup label="Müşteri">
                                    <FInput value={form.musteri} onChange={(e) => set("musteri", e.target.value)} />
                                </FGroup>

                                <FGroup label="Plaka">
                                    <FInput value={form.plaka} onChange={(e) => set("plaka", e.target.value)} />
                                </FGroup>

                                <FGroup label="Sürücü">
                                    <FInput value={form.surucu} onChange={(e) => set("surucu", e.target.value)} />
                                </FGroup>

                                <FGroup label="Telefon">
                                    <FInput value={form.aracTelefonu} onChange={(e) => set("aracTelefonu", e.target.value)} />
                                </FGroup>

                                <FGroup label="Cari Adı">
                                    <FInput value={form.cariAdi} onChange={(e) => set("cariAdi", e.target.value)} />
                                </FGroup>

                                <FGroup label="Kurye">
                                    <FInput value={form.kurye} onChange={(e) => set("kurye", e.target.value)} />
                                </FGroup>

                                <FGroup label="Bölge">
                                    <FSelect
                                        value={form.bolge}
                                        onChange={(e) => set("bolge", e.target.value)}
                                        options={["Avrupa", "Anadolu", "Bursa", "Trakya"]}
                                    />
                                </FGroup>

                                <FGroup label="Bölge Dağılım">
                                    <FInput value={form.bolgeDagilim} onChange={(e) => set("bolgeDagilim", e.target.value)} />
                                </FGroup>

                                <FGroup label="Başlangıç Tarihi">
                                    <FInput type="date" value={form.baslangicTarihi} onChange={(e) => set("baslangicTarihi", e.target.value)} />
                                </FGroup>
                            </div>
                        </div>

                        <div className="cm-card">
                            <div className="modal-section-title">Araç Bilgileri</div>

                            <div className="fg-grid fg-grid--3">
                                <FGroup label="Araç Türü">
                                    <FSelect
                                        value={form.aracTuru}
                                        onChange={(e) => set("aracTuru", e.target.value)}
                                        options={["Panelvan", "H.Kamyon", "Kamyonet", "Minivan", "Onteker", "Tır"]}
                                    />
                                </FGroup>

                                <FGroup label="Marka">
                                    <FInput value={form.marka} onChange={(e) => set("marka", e.target.value)} />
                                </FGroup>

                                <FGroup label="Model">
                                    <FInput value={form.model} onChange={(e) => set("model", e.target.value)} />
                                </FGroup>

                                <FGroup label="Yıl">
                                    <FInput value={form.yil} onChange={(e) => set("yil", e.target.value)} type="number" min="1990" max="2035" />
                                </FGroup>

                                <FGroup label="Hacim (m³)">
                                    <FInput value={form.aracMetreKup} onChange={(e) => set("aracMetreKup", e.target.value)} />
                                </FGroup>

                                <FGroup label="Yakıt Oranı">
                                    <FInput value={form.yakitOrani} onChange={(e) => set("yakitOrani", e.target.value)} type="number" />
                                </FGroup>

                                <FGroup label="Yakıt Oranı Satış">
                                    <FInput value={form.yakitOraniSatis} onChange={(e) => set("yakitOraniSatis", e.target.value)} type="number" />
                                </FGroup>

                                <FGroup label="Yakıt Oranı Maliyet">
                                    <FInput value={form.yakitOraniMaliyet} onChange={(e) => set("yakitOraniMaliyet", e.target.value)} type="number" />
                                </FGroup>
                            </div>
                        </div>

                        <div className="cm-card">
                            <div className="modal-section-title">Evrak & Finans</div>

                            <div className="fg-grid fg-grid--2">
                                <FGroup label="Satış (₺)">
                                    <FInput value={form.satis} onChange={(e) => set("satis", e.target.value)} type="number" />
                                </FGroup>

                                <FGroup label="Maliyet (₺)">
                                    <FInput value={form.maliyet} onChange={(e) => set("maliyet", e.target.value)} type="number" />
                                </FGroup>

                                <FGroup label="Senet Tutarı">
                                    <FInput value={form.senetTutari} onChange={(e) => set("senetTutari", e.target.value)} />
                                </FGroup>
                            </div>

                            <div className="toggle-row">
                                {[
                                    ["giydirme", "Giydirme"],
                                    ["sozlesme", "Sözleşme"],
                                    ["senet", "Senet"],
                                ].map(([k, l]) => (
                                    <label key={k} className="tog-label">
                                        <div className={`tog ${form[k] ? "tog--on" : ""}`} onClick={() => set(k, !form[k])}>
                                            <div className="tog__thumb" />
                                        </div>
                                        {l}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button className="drawer-btn drawer-btn--cancel" onClick={onClose}>
                            Vazgeç
                        </button>

                        <button className="drawer-btn drawer-btn--save" onClick={handleSave} disabled={saving}>
                            {saving ? "Kaydediliyor..." : row ? "Güncelle" : "Kaydet"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── STATS STRIP ──────────────────────────────────────────────────────────────
function StatsStrip({ rows, eksik }) {
    const totalSatis = rows.reduce((sum, r) => sum + r.satis, 0);
    const totalMaliyet = rows.reduce((sum, r) => sum + r.maliyet, 0);
    const totalKar = totalSatis - totalMaliyet;

    const stats = [
        { label: "Toplam Araç", value: rows.length, accent: "blue" },
        { label: "Eksik Evrak", value: eksik, accent: "red" },
        { label: "Toplam Satış", value: fCurrency(totalSatis), accent: "teal" },
        { label: "Toplam Maliyet", value: fCurrency(totalMaliyet), accent: "amber" },
        { label: "Toplam Kâr", value: fCurrency(totalKar), accent: totalKar >= 0 ? "green" : "red" },
    ];

    return (
        <div className="stats-strip">
            {stats.map((s) => (
                <div key={s.label} className={`stat-item stat-item--${s.accent}`}>
                    <div className="stat-item__label">{s.label}</div>
                    <div className="stat-item__value">{s.value}</div>
                </div>
            ))}
        </div>
    );
}

// ─── MAIN TABLE ───────────────────────────────────────────────────────────────
function VehicleTable({ rows, selectedKey, onSelect }) {
    if (!rows.length) {
        return (
            <div className="table-empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ opacity: 0.35, marginBottom: 10 }}>
                    <rect x="4" y="4" width="32" height="32" rx="6" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M12 20H28M12 26H22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M12 14H28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                Kayıt bulunamadı.
            </div>
        );
    }

    return (
        <div className="vtable-wrap">
            <table className="vtable">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Plaka</th>
                        <th>Müşteri</th>
                        <th>Sürücü</th>
                        <th>Araç Türü</th>
                        <th>Bölge</th>
                        <th>Evrak</th>
                        <th>Kâr / Zarar</th>
                        <th>Satış</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => {
                        const kar = row.satis - row.maliyet;
                        const rowKey = makeRowKey(row, index);
                        const isSelected = selectedKey === rowKey;
                        const hasIssue = row.sozlesme === "Yok" || row.senet === "Yok";

                        return (
                            <tr
                                key={rowKey}
                                className={`vtable__row ${isSelected ? "vtable__row--selected" : ""} ${hasIssue ? "vtable__row--warn" : ""}`}
                                onClick={() => onSelect(row, rowKey)}
                            >
                                <td className="vtable__num">{index + 1}</td>
                                <td>
                                    <span className="vtable__plate">{row.plaka}</span>
                                </td>
                                <td className="vtable__musteri">{row.musteri}</td>
                                <td className="vtable__muted">{row.surucu || "—"}</td>
                                <td>
                                    <TypeBadge type={row.aracTuru} />
                                </td>
                                <td className="vtable__muted">{row.bolge || "—"}</td>
                                <td>
                                    <div className="vtable__docs">
                                        <span className={`doc-dot ${row.sozlesme === "Var" ? "doc-dot--ok" : "doc-dot--bad"}`} title={`Sözleşme: ${row.sozlesme}`} />
                                        <span className={`doc-dot ${row.senet === "Var" ? "doc-dot--ok" : "doc-dot--bad"}`} title={`Senet: ${row.senet}`} />
                                        <span className={`doc-dot ${row.giydirme === "Var" ? "doc-dot--ok" : "doc-dot--muted"}`} title={`Giydirme: ${row.giydirme}`} />
                                    </div>
                                </td>
                                <td>
                                    <KarPill kar={kar} />
                                </td>
                                <td className="vtable__money">{fCurrency(row.satis)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── SUMMARY TAB ──────────────────────────────────────────────────────────────
function SummaryTab({ summaryRows, totals }) {
    const renderCell = (value, isTotal = false) => {
        if (!value) return <span className="vtable__muted">{isTotal ? "0" : ""}</span>;
        return <span className={isTotal ? "count-pill count-pill--total" : "count-pill"}>{value}</span>;
    };

    return (
        <div className="vtable-wrap">
            <table className="vtable vtable--summary">
                <thead>
                    <tr>
                        <th colSpan={5}>Operasyon Adı</th>
                        <th colSpan={6}>Araç Türü</th>
                    </tr>
                    <tr>
                        <th>Sıra</th>
                        <th>Müşteri Adı</th>
                        <th>Araç Sayısı</th>
                        <th>Dedike</th>
                        <th>Ftl</th>
                        <th>Panelvan</th>
                        <th>H.Kamyon</th>
                        <th>Kamyonet</th>
                        <th>Minivan</th>
                        <th>Onteker</th>
                        <th>Tır</th>
                    </tr>
                </thead>

                <tbody>
                    {summaryRows.map((r, index) => (
                        <tr key={makeSummaryKey(r, index)} className="vtable__row">
                            <td className="vtable__num">{r.sira}</td>
                            <td className="vtable__musteri">{r.musteri}</td>
                            <td className="vtable__center">{renderCell(r.aracSayisi)}</td>
                            <td className="vtable__center">{renderCell(r.dedike)}</td>
                            <td className="vtable__center">{renderCell(r.ftl)}</td>
                            <td className="vtable__center">{renderCell(r.panelvan)}</td>
                            <td className="vtable__center">{renderCell(r.hKamyon)}</td>
                            <td className="vtable__center">{renderCell(r.kamyonet)}</td>
                            <td className="vtable__center">{renderCell(r.minivan)}</td>
                            <td className="vtable__center">{renderCell(r.onteker)}</td>
                            <td className="vtable__center">{renderCell(r.tir)}</td>
                        </tr>
                    ))}

                    <tr className="vtable__row vtable__row--total">
                        <td className="vtable__num"></td>
                        <td className="vtable__musteri"><strong>Toplamlar</strong></td>
                        <td className="vtable__center">{renderCell(totals.aracSayisi, true)}</td>
                        <td className="vtable__center">{renderCell(totals.dedike, true)}</td>
                        <td className="vtable__center">{renderCell(totals.ftl, true)}</td>
                        <td className="vtable__center">{renderCell(totals.panelvan, true)}</td>
                        <td className="vtable__center">{renderCell(totals.hKamyon, true)}</td>
                        <td className="vtable__center">{renderCell(totals.kamyonet, true)}</td>
                        <td className="vtable__center">{renderCell(totals.minivan, true)}</td>
                        <td className="vtable__center">{renderCell(totals.onteker, true)}</td>
                        <td className="vtable__center">{renderCell(totals.tir, true)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

// ─── EVRAK TAB ────────────────────────────────────────────────────────────────
function EvrakTab({ rows, selectedKey, onSelect }) {
    return <VehicleTable rows={rows} selectedKey={selectedKey} onSelect={onSelect} />;
}

// ─── FINANS TAB ───────────────────────────────────────────────────────────────
function FinansTab({ rows, selectedKey, onSelect }) {
    const totalSatis = rows.reduce((sum, r) => sum + r.satis, 0);
    const totalMaliyet = rows.reduce((sum, r) => sum + r.maliyet, 0);
    const totalKar = totalSatis - totalMaliyet;

    const sortedRows = [...rows].sort((a, b) => (b.satis - b.maliyet) - (a.satis - a.maliyet));

    return (
        <>
            <div className="finans-strip">
                <div className="finans-strip__item">
                    <span>Toplam Satış</span>
                    <strong>{fCurrency(totalSatis)}</strong>
                </div>
                <div className="finans-strip__item">
                    <span>Toplam Maliyet</span>
                    <strong>{fCurrency(totalMaliyet)}</strong>
                </div>
                <div className="finans-strip__item">
                    <span>Toplam Kâr</span>
                    <strong className={totalKar < 0 ? "text-neg" : ""}>{fCurrency(totalKar)}</strong>
                </div>
            </div>

            <VehicleTable rows={sortedRows} selectedKey={selectedKey} onSelect={onSelect} />
        </>
    );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function ProjeOperasyonSayfasi() {
    const [rows, setRows] = useState([]);
    const [summaryRows, setSummaryRows] = useState([]);
    const [summaryTotals, setSummaryTotals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [bolge, setBolge] = useState("Tümü");
    const [tab, setTab] = useState("araclar");

    const [selectedRow, setSelectedRow] = useState(null);
    const [selectedRowKey, setSelectedRowKey] = useState(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editRow, setEditRow] = useState(null);

    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState({
        open: false,
        title: "",
        message: "",
        loading: false,
        onConfirm: null,
    });

    const BOLGE_LIST = ["Tümü", "Avrupa", "Anadolu", "Bursa", "Trakya"];

    const pushToast = useCallback((type, title, message = "", duration = 3200) => {
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        setToasts((prev) => [...prev, { id, type, title, message, duration }]);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const openConfirm = useCallback((config) => {
        setConfirmState({
            open: true,
            title: config.title || "Onay gerekli",
            message: config.message || "",
            loading: false,
            onConfirm: config.onConfirm || null,
        });
    }, []);

    const closeConfirm = useCallback(() => {
        setConfirmState({
            open: false,
            title: "",
            message: "",
            loading: false,
            onConfirm: null,
        });
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        const [{ data: vehicles, error: vehicleError }, { data: images, error: imageError }] =
            await Promise.all([
                supabase.from("araclar").select("*").order("plaka", { ascending: true }),
                supabase.from("arac_gorseller").select("*").order("created_at", { ascending: true }),
            ]);

        if (vehicleError || imageError) {
            console.error(vehicleError || imageError);
            setError("Araç verileri alınamadı.");
            pushToast("error", "Veriler alınamadı", "Supabase verileri okunurken hata oluştu.");
            setLoading(false);
            return;
        }

        const imageMap = groupImagesByVehicle(images || []);
        const mapped = (vehicles || []).map((item) => mapRow(item, imageMap.get(item.id) || {}));

        warnDuplicateIds(mapped);

        const summary = buildSummary(mapped);

        setRows(mapped);
        setSummaryRows(summary.rows);
        setSummaryTotals(summary.totals);
        setLoading(false);
    }, [pushToast]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();

        return rows.filter((r) => {
            const inBolge = bolge === "Tümü" || r.bolge === bolge;
            const inSearch =
                !q ||
                [r.musteri, r.plaka, r.surucu, r.cariAdi, r.kurye, r.bolge, r.marka, r.model, r.operasyonTuru]
                    .join(" ")
                    .toLowerCase()
                    .includes(q);

            return inBolge && inSearch;
        });
    }, [rows, search, bolge]);

    const eksikEvrakRows = useMemo(
        () => rows.filter((r) => r.sozlesme === "Yok" || r.senet === "Yok"),
        [rows]
    );

    const uploadToBucket = useCallback(async (file, folder = "arac") => {
        try {
            const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/\s+/g, "-")}`;
            const filePath = `${folder}/${safeName}`;

            const { error: uploadError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(filePath, file, { upsert: true });

            if (uploadError) {
                console.error("Storage upload hatası:", uploadError);
                setError(uploadError.message || "Görsel yüklenemedi.");
                pushToast("error", "Yükleme başarısız", uploadError.message || "Görsel yüklenemedi.");
                return null;
            }

            const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
            pushToast("success", "Görsel yüklendi", "Dosya başarıyla storage'a kaydedildi.");
            return data?.publicUrl || null;
        } catch (err) {
            console.error("uploadToBucket exception:", err);
            setError("Dosya yükleme sırasında beklenmeyen bir hata oluştu.");
            pushToast("error", "Yükleme başarısız", "Beklenmeyen bir hata oluştu.");
            return null;
        }
    }, [pushToast]);

    const onUploadVehicleImage = useCallback(
        async (aracId, file) => {
            const publicUrl = await uploadToBucket(file, "arac");
            if (!publicUrl) return false;

            const currentRow = rows.find((r) => r.id === aracId);
            const nextSira = (currentRow?.aracGorseller?.length || 0) + 1;

            const { error: insertError } = await supabase.from("arac_gorseller").insert([
                {
                    arac_id: aracId,
                    gorsel_url: publicUrl,
                    gorsel_tipi: "arac",
                    sira: nextSira,
                },
            ]);

            if (insertError) {
                console.error(insertError);
                setError("Araç görseli kaydedilemedi.");
                pushToast("error", "Kayıt başarısız", "Araç görseli veritabanına kaydedilemedi.");
                return false;
            }

            return true;
        },
        [rows, uploadToBucket, pushToast]   // ✅ DÜZELTİLDİ
    );
    const onUploadSingleDoc = useCallback(async (aracId, type, file) => {
        const publicUrl = await uploadToBucket(file, type);
        if (!publicUrl) return false;

        const { data: existing, error: existingError } = await supabase
            .from("arac_gorseller")
            .select("id")
            .eq("arac_id", aracId)
            .eq("gorsel_tipi", type)
            .limit(1);

        if (existingError) {
            console.error(existingError);
            setError("Belge kontrol edilemedi.");
            return false;
        }

        if (existing?.length) {
            await supabase
                .from("arac_gorseller")
                .update({ gorsel_url: publicUrl, sira: 1 })
                .eq("id", existing[0].id);
        } else {
            await supabase.from("arac_gorseller").insert([
                {
                    arac_id: aracId,
                    gorsel_url: publicUrl,
                    gorsel_tipi: type,
                    sira: 1,
                },
            ]);
        }

        return true;
    }, [uploadToBucket]);   // ✅ DÜZELTİLDİ

    const performDeleteImage = useCallback(
        async (image) => {
            try {
                if (!image?.id) {
                    setError("Silinecek görsel kaydı bulunamadı.");
                    pushToast("error", "Silme başarısız", "Geçerli görsel bulunamadı.");
                    return false;
                }

                const storagePath = getStoragePathFromUrl(image.gorsel_url);

                if (storagePath) {
                    const { error: storageDeleteError } = await supabase.storage
                        .from(STORAGE_BUCKET)
                        .remove([storagePath]);

                    if (storageDeleteError) {
                        console.error("Storage silme hatası:", storageDeleteError);
                        setError(storageDeleteError.message || "Storage görseli silinemedi.");
                        pushToast("error", "Storage silinemedi", storageDeleteError.message || "");
                        return false;
                    }
                }

                const { error: dbDeleteError } = await supabase
                    .from("arac_gorseller")
                    .delete()
                    .eq("id", image.id);

                if (dbDeleteError) {
                    console.error("DB silme hatası:", dbDeleteError);
                    setError(dbDeleteError.message || "Görsel kaydı silinemedi.");
                    pushToast("error", "Kayıt silinemedi", dbDeleteError.message || "");
                    return false;
                }

                await load();
                pushToast("success", "Görsel silindi", "Seçilen görsel sistemden kaldırıldı.");
                return true;
            } catch (err) {
                console.error("performDeleteImage exception:", err);
                setError("Görsel silinirken beklenmeyen bir hata oluştu.");
                pushToast("error", "Silme başarısız", "Beklenmeyen bir hata oluştu.");
                return false;
            }
        },
        [load, pushToast]
    );

    const onDeleteImage = useCallback(
        (image) => {
            openConfirm({
                title: "Görsel silinsin mi?",
                message: "Bu görsel hem listeden hem storage alanından kalıcı olarak silinecek.",
                onConfirm: async () => {
                    setConfirmState((prev) => ({ ...prev, loading: true }));
                    const ok = await performDeleteImage(image);
                    if (ok) closeConfirm();
                    else setConfirmState((prev) => ({ ...prev, loading: false }));
                },
            });
        },
        [performDeleteImage, openConfirm, closeConfirm]
    );

    const handleSelect = useCallback((row, rowKey) => {
        setSelectedRowKey((prevKey) => {
            if (prevKey === rowKey) {
                setSelectedRow(null);
                return null;
            }

            setSelectedRow(row);
            return rowKey;
        });
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedRow(null);
        setSelectedRowKey(null);
    }, []);

    const handleSave = async (form, pendingUploads = null) => {
        const payload = {
            musteri: form.musteri,
            plaka: form.plaka,
            arac_telefonu: form.aracTelefonu,
            surucu: form.surucu,
            cari_adi: form.cariAdi,
            kurye: form.kurye,
            bolge: form.bolge,
            bolge_dagilim: form.bolgeDagilim,
            arac_turu: form.aracTuru,
            marka: form.marka,
            model: form.model,
            yil: form.yil ? Number(form.yil) : null,
            giydirme: !!form.giydirme,
            sozlesme: !!form.sozlesme,
            senet: !!form.senet,
            senet_tutari: form.senetTutari
                ? Number(String(form.senetTutari).replace(/\./g, "").replace(",", "."))
                : 0,
            arac_metre_kup: form.aracMetreKup,
            yakit_orani: form.yakitOrani ? Number(form.yakitOrani) : 0,
            yakit_orani_satis: form.yakitOraniSatis ? Number(form.yakitOraniSatis) : 0,
            yakit_orani_maliyet: form.yakitOraniMaliyet ? Number(form.yakitOraniMaliyet) : 0,
            baslangic_tarihi: form.baslangicTarihi || null,
            satis: form.satis ? Number(form.satis) : 0,
            maliyet: form.maliyet ? Number(form.maliyet) : 0,
        };

        let savedVehicleId = form.id;

        if (form.id) {
            const { error: updateError } = await supabase.from("araclar").update(payload).eq("id", form.id);

            if (updateError) {
                console.error(updateError);
                setError("Araç güncellenemedi.");
                pushToast("error", "Güncelleme başarısız", "Araç kaydı güncellenemedi.");
                return null;
            }
        } else {
            const { data: insertedRow, error: insertError } = await supabase
                .from("araclar")
                .insert([payload])
                .select("id")
                .single();

            if (insertError) {
                console.error(insertError);
                setError("Araç eklenemedi.");
                pushToast("error", "Kayıt başarısız", "Yeni araç kaydı eklenemedi.");
                return null;
            }

            savedVehicleId = insertedRow.id;
        }

        if (pendingUploads && savedVehicleId) {
            const { vehicleImages = [], docs = {} } = pendingUploads;

            for (let i = 0; i < vehicleImages.length; i++) {
                await onUploadVehicleImage(savedVehicleId, vehicleImages[i]);
            }

            if (docs.ruhsat) await onUploadSingleDoc(savedVehicleId, "ruhsat", docs.ruhsat);
            if (docs.police) await onUploadSingleDoc(savedVehicleId, "police", docs.police);
            if (docs.ehliyet_ruhsat) await onUploadSingleDoc(savedVehicleId, "ehliyet_ruhsat", docs.ehliyet_ruhsat);
        }

        await load();

        pushToast(
            "success",
            form.id ? "Araç güncellendi" : "Araç eklendi",
            form.plaka ? `${form.plaka} kaydı başarıyla işlendi.` : "Kayıt işlemi tamamlandı."
        );

        return savedVehicleId;
    };

    const handleExport = () => {
        if (tab === "ozet") {
            const exportRows = [
                ...summaryRows.map((r) => ({
                    Sıra: r.sira,
                    "Müşteri Adı": r.musteri,
                    "Araç Sayısı": r.aracSayisi,
                    Dedike: r.dedike,
                    Ftl: r.ftl,
                    Panelvan: r.panelvan,
                    "H.Kamyon": r.hKamyon,
                    Kamyonet: r.kamyonet,
                    Minivan: r.minivan,
                    Onteker: r.onteker,
                    Tır: r.tir,
                })),
                {
                    Sıra: "",
                    "Müşteri Adı": "Toplamlar",
                    "Araç Sayısı": summaryTotals?.aracSayisi || 0,
                    Dedike: summaryTotals?.dedike || 0,
                    Ftl: summaryTotals?.ftl || 0,
                    Panelvan: summaryTotals?.panelvan || 0,
                    "H.Kamyon": summaryTotals?.hKamyon || 0,
                    Kamyonet: summaryTotals?.kamyonet || 0,
                    Minivan: summaryTotals?.minivan || 0,
                    Onteker: summaryTotals?.onteker || 0,
                    Tır: summaryTotals?.tir || 0,
                },
            ];

            exportXLSX(exportRows, "proje-operasyon-ozet", "Ozet");
            return;
        }

        const exportRows = filtered.map((r, i) => ({
            Sira: i + 1,
            Musteri: r.musteri,
            Plaka: r.plaka,
            Surucu: r.surucu,
            CariAdi: r.cariAdi,
            Kurye: r.kurye,
            Bolge: r.bolge,
            BolgeDagilim: r.bolgeDagilim,
            OperasyonTuru: r.operasyonTuru,
            AracTuru: r.aracTuru,
            Marka: r.marka,
            Model: r.model,
            Yil: r.yil,
            Giydirme: r.giydirme,
            Sozlesme: r.sozlesme,
            Senet: r.senet,
            SenetTutari: r.senetTutari,
            AracMetreKup: r.aracMetreKup,
            YakitOrani: r.yakitOrani,
            YakitOraniSatis: r.yakitOraniSatis,
            YakitOraniMaliyet: r.yakitOraniMaliyet,
            BaslangicTarihi: r.baslangicTarihiText,
            Satis: r.satis,
            Maliyet: r.maliyet,
            Kar: r.satis - r.maliyet,
        }));

        exportXLSX(exportRows, "proje-operasyon");
    };

    const handleNewVehicle = () => {
        setEditRow(null);
        setEditOpen(true);
    };

    const handleEditVehicle = (row) => {
        setEditRow(row);
        setEditOpen(true);
    };

    if (loading) {
        return (
            <div className="po-page po-page--loading">
                <div className="po-loader">
                    <div className="po-loader__ring" />
                    <div>Yükleniyor...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="po-page">
            <div className="po-header">
                <div>
                    <div className="po-header__title">Proje Operasyon</div>
                    <div className="po-header__sub">Araç, evrak, görsel ve finans yönetimi</div>
                </div>

                <div className="po-header__right">
                    <button className="hdr-btn hdr-btn--ghost" onClick={handleExport}>
                        Excel Al
                    </button>
                    <button className="hdr-btn hdr-btn--primary" onClick={handleNewVehicle}>
                        Yeni Araç
                    </button>
                </div>
            </div>

            {error ? <div className="po-error">{error}</div> : null}

            <StatsStrip rows={rows} eksik={eksikEvrakRows.length} />

            <div className="po-tabs">
                <button className={`po-tab ${tab === "araclar" ? "po-tab--active" : ""}`} onClick={() => setTab("araclar")}>
                    Araçlar
                </button>

                <button className={`po-tab ${tab === "evrak" ? "po-tab--active" : ""}`} onClick={() => setTab("evrak")}>
                    Evrak
                    {eksikEvrakRows.length > 0 && <span className="po-tab__badge">{eksikEvrakRows.length}</span>}
                </button>

                <button className={`po-tab ${tab === "finans" ? "po-tab--active" : ""}`} onClick={() => setTab("finans")}>
                    Finans
                </button>

                <button className={`po-tab ${tab === "ozet" ? "po-tab--active" : ""}`} onClick={() => setTab("ozet")}>
                    Özet
                </button>
            </div>

            <div className="po-main">
                <div className="po-toolbar">
                    <div className="po-search">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>

                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Müşteri, plaka, sürücü, marka..."
                        />
                    </div>

                    <div className="po-segment">
                        {BOLGE_LIST.map((item) => (
                            <button
                                key={item}
                                className={`po-seg-btn ${bolge === item ? "po-seg-btn--active" : ""}`}
                                onClick={() => setBolge(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    <div className="po-count">{filtered.length} kayıt</div>
                </div>

                {tab === "araclar" && (
                    <VehicleTable rows={filtered} selectedKey={selectedRowKey} onSelect={handleSelect} />
                )}

                {tab === "evrak" && (
                    <EvrakTab rows={eksikEvrakRows} selectedKey={selectedRowKey} onSelect={handleSelect} />
                )}

                {tab === "finans" && (
                    <FinansTab rows={filtered} selectedKey={selectedRowKey} onSelect={handleSelect} />
                )}

                {tab === "ozet" && (
                    <SummaryTab
                        summaryRows={summaryRows}
                        totals={summaryTotals || {
                            aracSayisi: 0,
                            dedike: 0,
                            ftl: 0,
                            panelvan: 0,
                            hKamyon: 0,
                            kamyonet: 0,
                            minivan: 0,
                            onteker: 0,
                            tir: 0,
                        }}
                    />
                )}
            </div>

            <DetailModal
                row={selectedRow}
                open={!!selectedRow}
                onClose={handleCloseModal}
                onEdit={handleEditVehicle}
            />

            <EditModal
                open={editOpen}
                row={editRow}
                onClose={() => setEditOpen(false)}
                onSave={handleSave}
                onDeleteImage={(img) => onDeleteImage(img)}
            />

            <ToastCenter items={toasts} onClose={removeToast} />

            <ConfirmModal
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                loading={confirmState.loading}
                onClose={closeConfirm}
                onConfirm={confirmState.onConfirm}
            />
        </div>
    );
}