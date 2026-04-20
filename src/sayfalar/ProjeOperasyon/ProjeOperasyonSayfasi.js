import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./projeOperasyon.css";
import { supabase } from "../../lib/supabase";

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
    return v ? `%${v}` : "—";
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
    return [
        row?.id ?? "noid",
        row?.plaka ?? "noplate",
        row?.musteri ?? "nocustomer",
        row?.surucu ?? "nodriver",
        row?.sira ?? index,
        index,
    ].join("__");
}

function makeSummaryKey(row, index = 0) {
    return [row?.musteri ?? "Bilinmeyen", row?.sira ?? index, index].join("__");
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

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
function mapRow(item) {
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
        senetTutari: fMoney(item.senet_tutari),
        aracMetreKup: item.arac_metre_kup ?? "",
        yakitOrani: fPct(item.yakit_orani),
        baslangicTarihi: item.baslangic_tarihi ?? "",
        baslangicTarihiText: fDate(item.baslangic_tarihi),
        satis: Number(item.satis || 0),
        maliyet: Number(item.maliyet || 0),
        vehicleImage: item.vehicle_image_url ?? null,
        licenseImage: item.license_image_url ?? null,
        note: item.note ?? "",
        dedikeBool: !!item.dedike,
        ftlBool: !!item.ftl,
    };
}

function buildSummary(rows) {
    const grouped = {};

    rows.forEach((r) => {
        const musteri = r.musteri || "Bilinmeyen";

        if (!grouped[musteri]) {
            grouped[musteri] = {
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

        grouped[musteri].aracSayisi++;
        if (r.dedikeBool) grouped[musteri].dedike++;
        if (r.ftlBool) grouped[musteri].ftl++;

        if (r.aracTuru === "Panelvan") grouped[musteri].panelvan++;
        if (r.aracTuru === "H.Kamyon") grouped[musteri].hKamyon++;
        if (r.aracTuru === "Kamyonet") grouped[musteri].kamyonet++;
        if (r.aracTuru === "Minivan") grouped[musteri].minivan++;
        if (r.aracTuru === "Onteker") grouped[musteri].onteker++;
        if (r.aracTuru === "Tır") grouped[musteri].tir++;
    });

    return Object.values(grouped).map((item, index) => ({
        ...item,
        sira: index + 1,
    }));
}

// ─── SMALL UI ATOMS ───────────────────────────────────────────────────────────
function DocPill({ label, ok }) {
    return (
        <span className={`doc-pill ${ok ? "doc-pill--ok" : "doc-pill--missing"}`}>
            {ok ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                        d="M2 5L4 7L8 3"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            ) : (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                        d="M3 3L7 7M7 3L3 7"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                    />
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

// ─── IMAGE UPLOADER ───────────────────────────────────────────────────────────
function ImageUploader({ label, image, onUpload, icon }) {
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
                    <span className="img-uploader__hint">Tıkla veya sürükle</span>
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

// ─── DRAWER ───────────────────────────────────────────────────────────────────
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
    baslangicTarihi: "",
    satis: "",
    maliyet: "",
    note: "",
    vehicleImage: null,
    licenseImage: null,
};

function Drawer({ open, row, onClose, onSave }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

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
                baslangicTarihi: row.baslangicTarihi || "",
                satis: row.satis || "",
                maliyet: row.maliyet || "",
                note: row.note || "",
                vehicleImage: row.vehicleImage || null,
                licenseImage: row.licenseImage || null,
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [row, open]);

    const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave({ ...form, id: row?.id });
        } finally {
            setSaving(false);
            onClose();
        }
    };

    if (!open) return null;

    return (
        <>
            <div className="drawer-backdrop" onClick={onClose} />
            <aside className="drawer">
                <div className="drawer__header">
                    <div>
                        <div className="drawer__title">{row ? "Araç Düzenle" : "Yeni Araç Ekle"}</div>
                        <div className="drawer__sub">{row ? row.plaka : "Tüm bilgileri doldurun"}</div>
                    </div>

                    <button className="drawer__close" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path
                                d="M2 2L14 14M14 2L2 14"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>

                <div className="drawer__body">
                    <div className="drawer__section-title">Görseller</div>

                    <div className="img-pair">
                        <ImageUploader
                            label="Araç Fotoğrafı"
                            image={form.vehicleImage}
                            onUpload={(u) => set("vehicleImage", u)}
                            icon={
                                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                    <path
                                        d="M4 20L9 14L13 18L17 12L24 20H4Z"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinejoin="round"
                                    />
                                    <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                                    <rect x="2" y="2" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="1.5" />
                                </svg>
                            }
                        />

                        <ImageUploader
                            label="Ruhsat / Belge"
                            image={form.licenseImage}
                            onUpload={(u) => set("licenseImage", u)}
                            icon={
                                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                    <rect x="5" y="2" width="18" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M9 8H19M9 12H19M9 16H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                            }
                        />
                    </div>

                    <div className="drawer__section-title">Genel Bilgiler</div>

                    <div className="fg-grid fg-grid--2">
                        <FGroup label="Müşteri">
                            <FInput value={form.musteri} onChange={(e) => set("musteri", e.target.value)} placeholder="Müşteri adı" />
                        </FGroup>

                        <FGroup label="Plaka">
                            <FInput value={form.plaka} onChange={(e) => set("plaka", e.target.value)} placeholder="34 ABC 123" />
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

                    <div className="drawer__section-title">Araç Bilgileri</div>

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
                            <FInput value={form.yil} onChange={(e) => set("yil", e.target.value)} type="number" min="1990" max="2030" />
                        </FGroup>

                        <FGroup label="Hacim (m³)">
                            <FInput value={form.aracMetreKup} onChange={(e) => set("aracMetreKup", e.target.value)} />
                        </FGroup>

                        <FGroup label="Yakıt Oranı (%)">
                            <FInput value={form.yakitOrani} onChange={(e) => set("yakitOrani", e.target.value)} type="number" />
                        </FGroup>
                    </div>

                    <div className="drawer__section-title">Evrak & Finans</div>

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

                    <div className="drawer__section-title">Not</div>

                    <textarea
                        className="fg__textarea"
                        value={form.note}
                        onChange={(e) => set("note", e.target.value)}
                        placeholder="Araçla ilgili notlar..."
                        rows={3}
                    />
                </div>

                <div className="drawer__footer">
                    <button className="drawer-btn drawer-btn--cancel" onClick={onClose}>
                        Vazgeç
                    </button>
                    <button className="drawer-btn drawer-btn--save" onClick={handleSave} disabled={saving}>
                        {saving ? "Kaydediliyor..." : row ? "Güncelle" : "Kaydet"}
                    </button>
                </div>
            </aside>
        </>
    );
}

// ─── DETAIL PANEL ─────────────────────────────────────────────────────────────
function DetailPanel({ row, onClose, onEdit, onImageUpload, onNoteChange }) {
    if (!row) return null;

    const kar = (row.satis || 0) - (row.maliyet || 0);

    return (
        <div className="detail-panel">
            <div className="detail-panel__header">
                <div>
                    <div className="detail-panel__plate">{row.plaka}</div>
                    <div className="detail-panel__driver">{row.surucu}</div>
                </div>

                <div className="detail-panel__actions">
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
                            <path
                                d="M2 2L12 12M12 2L2 12"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="detail-panel__body">
                <div className="dp-imgs">
                    <ImageUploader
                        label="Araç Fotoğrafı"
                        image={row.vehicleImage}
                        onUpload={(u) => onImageUpload(row.id, "vehicleImage", u)}
                        icon={
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M3 16L8 10L12 14L15 9L21 16H3Z"
                                    stroke="currentColor"
                                    strokeWidth="1.4"
                                    strokeLinejoin="round"
                                />
                                <circle cx="8" cy="7" r="2" stroke="currentColor" strokeWidth="1.4" />
                                <rect x="1" y="1" width="22" height="22" rx="4" stroke="currentColor" strokeWidth="1.4" />
                            </svg>
                        }
                    />

                    <ImageUploader
                        label="Ruhsat"
                        image={row.licenseImage}
                        onUpload={(u) => onImageUpload(row.id, "licenseImage", u)}
                        icon={
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <rect x="4" y="1" width="16" height="22" rx="3" stroke="currentColor" strokeWidth="1.4" />
                                <path d="M8 7H16M8 11H16M8 15H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                            </svg>
                        }
                    />
                </div>

                <div className="dp-finans">
                    <div className="dp-fin-item">
                        <span>Satış</span>
                        <strong>{fCurrency(row.satis)}</strong>
                    </div>
                    <div className="dp-fin-item">
                        <span>Maliyet</span>
                        <strong>{fCurrency(row.maliyet)}</strong>
                    </div>
                    <div className={`dp-fin-item dp-fin-item--kar ${kar >= 0 ? "dp-fin-item--pos" : "dp-fin-item--neg"}`}>
                        <span>Kâr</span>
                        <strong>{fCurrency(kar)}</strong>
                    </div>
                </div>

                <div className="dp-docs">
                    <DocPill label="Giydirme" ok={row.giydirme === "Var"} />
                    <DocPill label="Sözleşme" ok={row.sozlesme === "Var"} />
                    <DocPill label="Senet" ok={row.senet === "Var"} />
                </div>

                <div className="dp-info-grid">
                    {[
                        ["Müşteri", row.musteri],
                        ["Cari Adı", row.cariAdi],
                        ["Kurye", row.kurye],
                        ["Telefon", row.aracTelefonu],
                        ["Bölge", row.bolge],
                        ["Dağılım", row.bolgeDagilim],
                        ["Marka", row.marka],
                        ["Model", row.model],
                        ["Yıl", row.yil],
                        ["Tür", row.aracTuru],
                        ["Hacim", row.aracMetreKup],
                        ["Yakıt", row.yakitOrani],
                        ["Senet Tutarı", row.senetTutari],
                        ["Başlangıç", row.baslangicTarihiText || row.baslangicTarihi],
                    ].map(([k, v]) => (
                        <div key={k} className="dp-info-row">
                            <span className="dp-info-label">{k}</span>
                            <span className="dp-info-val">{v || "—"}</span>
                        </div>
                    ))}
                </div>

                <div className="dp-note-wrap">
                    <div className="dp-note-label">Not</div>
                    <textarea
                        className="dp-note-input"
                        value={row.note || ""}
                        onChange={(e) => onNoteChange(row.id, e.target.value)}
                        placeholder="Not ekle..."
                        rows={3}
                    />
                </div>
            </div>
        </div>
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
                                <td className="vtable__num">{row.sira}</td>
                                <td>
                                    <span className="vtable__plate">{row.plaka}</span>
                                </td>
                                <td className="vtable__musteri">{row.musteri}</td>
                                <td className="vtable__muted">{row.surucu || "—"}</td>
                                <td>
                                    <TypeBadge type={row.aracTuru} />
                                </td>
                                <td className="vtable__muted">{row.bolge}</td>
                                <td>
                                    <div className="vtable__docs">
                                        <span
                                            className={`doc-dot ${row.sozlesme === "Var" ? "doc-dot--ok" : "doc-dot--bad"}`}
                                            title={`Sözleşme: ${row.sozlesme}`}
                                        />
                                        <span
                                            className={`doc-dot ${row.senet === "Var" ? "doc-dot--ok" : "doc-dot--bad"}`}
                                            title={`Senet: ${row.senet}`}
                                        />
                                        <span
                                            className={`doc-dot ${row.giydirme === "Var" ? "doc-dot--ok" : "doc-dot--muted"}`}
                                            title={`Giydirme: ${row.giydirme}`}
                                        />
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
function SummaryTab({ summaryRows }) {
    return (
        <div className="vtable-wrap">
            <table className="vtable">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Müşteri</th>
                        <th>Araç</th>
                        <th>Dedike</th>
                        <th>FTL</th>
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
                            {[r.aracSayisi, r.dedike, r.ftl, r.panelvan, r.hKamyon, r.kamyonet, r.minivan, r.onteker, r.tir].map((v, i) => (
                                <td key={`${makeSummaryKey(r, index)}__${i}`} className="vtable__center">
                                    {v > 0 ? <span className="count-pill">{v}</span> : <span className="vtable__muted">—</span>}
                                </td>
                            ))}
                        </tr>
                    ))}
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [bolge, setBolge] = useState("Tümü");
    const [tab, setTab] = useState("araclar");

    const [selectedRow, setSelectedRow] = useState(null);
    const [selectedRowKey, setSelectedRowKey] = useState(null);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editRow, setEditRow] = useState(null);

    const BOLGE_LIST = ["Tümü", "Avrupa", "Anadolu", "Bursa", "Trakya"];

    const load = useCallback(async () => {
        setLoading(true);
        setError("");

        const { data, error: dbError } = await supabase
            .from("araclar")
            .select("*")
            .order("sira", { ascending: true });

        if (dbError) {
            setError("Araç verileri alınamadı.");
            setLoading(false);
            return;
        }

        const mapped = (data || []).map(mapRow);

        warnDuplicateIds(mapped);

        setRows(mapped);
        setSummaryRows(buildSummary(mapped));
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
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
                    r.marka,
                    r.model,
                ]
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

    const handleImageUpload = useCallback((id, field, url) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: url } : r)));
        setSelectedRow((prev) => (prev?.id === id ? { ...prev, [field]: url } : prev));
    }, []);

    const handleNoteChange = useCallback(async (id, value) => {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, note: value } : r)));
        setSelectedRow((prev) => (prev?.id === id ? { ...prev, note: value } : prev));

        await supabase.from("araclar").update({ note: value }).eq("id", id);
    }, []);

    const handleSave = async (form) => {
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
            sozlesme_var: !!form.sozlesme,
            senet_var: !!form.senet,
            senet_tutari: form.senetTutari ? Number(String(form.senetTutari).replace(/\./g, "").replace(",", ".")) : 0,
            arac_metre_kup: form.aracMetreKup,
            yakit_orani: form.yakitOrani ? Number(form.yakitOrani) : 0,
            baslangic_tarihi: form.baslangicTarihi || null,
            satis: form.satis ? Number(form.satis) : 0,
            maliyet: form.maliyet ? Number(form.maliyet) : 0,
            note: form.note ?? "",
            vehicle_image_url: form.vehicleImage ?? null,
            license_image_url: form.licenseImage ?? null,
        };

        if (form.id) {
            const { error: updateError } = await supabase.from("araclar").update(payload).eq("id", form.id);
            if (updateError) {
                console.error(updateError);
                setError("Araç güncellenemedi.");
                return;
            }
        } else {
            const { error: insertError } = await supabase.from("araclar").insert([payload]);
            if (insertError) {
                console.error(insertError);
                setError("Araç eklenemedi.");
                return;
            }
        }

        await load();
    };

    const openAdd = () => {
        setEditRow(null);
        setDrawerOpen(true);
    };

    const openEdit = (row) => {
        setEditRow(row);
        setDrawerOpen(true);
    };

    const exportAll = () => {
        exportXLSX(
            rows.map((r) => ({
                Sıra: r.sira,
                Müşteri: r.musteri,
                Plaka: r.plaka,
                Sürücü: r.surucu,
                Cari: r.cariAdi,
                Kurye: r.kurye,
                Bölge: r.bolge,
                Dağılım: r.bolgeDagilim,
                "Araç Türü": r.aracTuru,
                Marka: r.marka,
                Model: r.model,
                Yıl: r.yil,
                Sözleşme: r.sozlesme,
                Senet: r.senet,
                Satış: r.satis,
                Maliyet: r.maliyet,
                Kâr: r.satis - r.maliyet,
            })),
            "Arac_Listesi",
            "Araçlar"
        );
    };

    if (loading) {
        return (
            <div className="po-page po-page--loading">
                <div className="po-loader">
                    <div className="po-loader__ring" />
                    <span>Yükleniyor...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="po-page">
            <header className="po-header">
                <div className="po-header__left">
                    <div className="po-header__title">Araç Operasyonu</div>
                    <div className="po-header__sub">Araç yönetimi, evrak takibi ve finans raporu</div>
                </div>

                <div className="po-header__right">
                    <button className="hdr-btn hdr-btn--ghost" onClick={exportAll}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path
                                d="M7 1V9M7 9L4 6M7 9L10 6"
                                stroke="currentColor"
                                strokeWidth="1.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <path d="M2 11H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        Excel
                    </button>

                    <button className="hdr-btn hdr-btn--primary" onClick={openAdd}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        Yeni Araç
                    </button>
                </div>
            </header>

            {error && <div className="po-error">{error}</div>}

            <StatsStrip rows={rows} eksik={eksikEvrakRows.length} />

            <div className="po-tabs">
                {[
                    ["araclar", "Araçlar"],
                    ["ozet", "Operasyon Özeti"],
                    ["evrak", "Eksik Evrak"],
                    ["finans", "Finans"],
                ].map(([k, l]) => (
                    <button
                        key={k}
                        className={`po-tab ${tab === k ? "po-tab--active" : ""}`}
                        onClick={() => {
                            setTab(k);
                            setSelectedRow(null);
                            setSelectedRowKey(null);
                        }}
                    >
                        {l}
                        {k === "evrak" && eksikEvrakRows.length > 0 && (
                            <span className="po-tab__badge">{eksikEvrakRows.length}</span>
                        )}
                    </button>
                ))}
            </div>

            <div className={`po-content ${selectedRow ? "po-content--split" : ""}`}>
                <div className="po-main">
                    {tab === "araclar" && (
                        <div className="po-toolbar">
                            <div className="po-search">
                                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                                    <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                                    <path d="M10 10L13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                </svg>

                                <input
                                    placeholder="Plaka, sürücü, müşteri..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="po-segment">
                                {BOLGE_LIST.map((b) => (
                                    <button
                                        key={b}
                                        className={`po-seg-btn ${bolge === b ? "po-seg-btn--active" : ""}`}
                                        onClick={() => setBolge(b)}
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>

                            <span className="po-count">{filtered.length} araç</span>
                        </div>
                    )}

                    {tab === "araclar" && (
                        <VehicleTable rows={filtered} selectedKey={selectedRowKey} onSelect={handleSelect} />
                    )}

                    {tab === "ozet" && <SummaryTab summaryRows={summaryRows} />}

                    {tab === "evrak" && (
                        <EvrakTab rows={eksikEvrakRows} selectedKey={selectedRowKey} onSelect={handleSelect} />
                    )}

                    {tab === "finans" && (
                        <FinansTab rows={rows} selectedKey={selectedRowKey} onSelect={handleSelect} />
                    )}
                </div>

                {selectedRow && tab !== "ozet" && (
                    <DetailPanel
                        row={selectedRow}
                        onClose={() => {
                            setSelectedRow(null);
                            setSelectedRowKey(null);
                        }}
                        onEdit={openEdit}
                        onImageUpload={handleImageUpload}
                        onNoteChange={handleNoteChange}
                    />
                )}
            </div>

            <Drawer
                open={drawerOpen}
                row={editRow}
                onClose={() => setDrawerOpen(false)}
                onSave={handleSave}
            />
        </div>
    );
}