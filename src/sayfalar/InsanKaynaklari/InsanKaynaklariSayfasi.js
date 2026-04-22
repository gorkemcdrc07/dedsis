import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./insanKaynaklariSayfasi.css";
import { supabase } from "../../lib/supabase";

const monthOptions = [
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

const yearOptions = ["2025", "2026", "2027"];

function isRowEmpty(row) {
    if (!row || !Array.isArray(row)) return true;
    return row.every(
        (cell) => cell === null || cell === undefined || String(cell).trim() === ""
    );
}

function normalizeHeaders(headerRow) {
    return headerRow.map((cell, index) => {
        const value = String(cell || "")
            .replace(/\n/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        return value || `Kolon ${index + 1}`;
    });
}

function rowToObject(headers, row, rowIndex) {
    const obj = {};
    headers.forEach((header, index) => {
        obj[header] = row[index] ?? "";
    });
    obj._rowId = `${rowIndex + 1}-${Math.random().toString(36).slice(2, 9)}`;
    return obj;
}

function parseExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const data = event.target.result;
                if (!data) {
                    reject(new Error("Dosya okunamadı."));
                    return;
                }

                const workbook = XLSX.read(data, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawRows = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: "",
                    raw: true,
                });

                const firstNonEmptyRowIndex = rawRows.findIndex((row) => !isRowEmpty(row));
                if (firstNonEmptyRowIndex === -1) {
                    reject(new Error("Excel içinde veri bulunamadı."));
                    return;
                }

                const headerRow = rawRows[firstNonEmptyRowIndex];
                const headers = normalizeHeaders(headerRow);
                const rows = [];
                let summaryRow = null;
                let sawEmptyRowAfterData = false;

                for (let i = firstNonEmptyRowIndex + 1; i < rawRows.length; i += 1) {
                    const currentRow = rawRows[i];

                    if (isRowEmpty(currentRow)) {
                        if (rows.length > 0) sawEmptyRowAfterData = true;
                        continue;
                    }

                    if (sawEmptyRowAfterData) {
                        summaryRow = rowToObject(headers, currentRow, i);
                        break;
                    }

                    rows.push(rowToObject(headers, currentRow, i));
                }

                resolve({
                    fileName: file.name,
                    sheetName: firstSheetName,
                    headers,
                    rows,
                    summaryRow,
                });
            } catch (error) {
                reject(
                    error instanceof Error
                        ? error
                        : new Error("Excel dosyası işlenirken hata oluştu.")
                );
            }
        };

        reader.onerror = () => reject(new Error("Dosya okunurken hata oluştu."));
        reader.readAsArrayBuffer(file);
    });
}

function toNumberTR(value) {
    if (value === null || value === undefined || value === "") return 0;

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    let text = String(value).trim();
    if (!text) return 0;

    text = text
        .replace(/\u00A0/g, "")
        .replace(/\s/g, "")
        .replace(/[₺]/g, "");

    const lastDot = text.lastIndexOf(".");
    const lastComma = text.lastIndexOf(",");

    if (lastComma > lastDot) {
        text = text.replace(/\./g, "").replace(",", ".");
    } else if (lastDot > lastComma) {
        text = text.replace(/,/g, "");
    } else {
        text = text.replace(/,/g, ".");
    }

    text = text.replace(/[^\d.-]/g, "");

    const num = Number(text);
    return Number.isNaN(num) ? 0 : num;
}

function formatMoney(value) {
    return new Intl.NumberFormat("tr-TR", {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 2,
    }).format(Number(value || 0));
}

function normalizeName(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleUpperCase("tr-TR");
}

function detectAdSoyadColumn(row) {
    const possibleNames = [
        "Adı Soyadı",
        "ADI SOYADI",
        "Ad Soyad",
        "AD SOYAD",
        "Personel Adı Soyadı",
        "PERSONEL ADI SOYADI",
        "Çalışan Adı Soyadı",
        "ÇALIŞAN ADI SOYADI",
        "Adı Soyadı ",
        "Adi Soyadi",
        "Personel",
        "PERSONEL",
        "Ad",
        "AD",
    ];

    const found = possibleNames.find(
        (key) => row[key] !== undefined && String(row[key] || "").trim() !== ""
    );
    if (found) return found;

    const keys = Object.keys(row).filter((k) => !k.startsWith("_"));
    return (
        keys.find((key) => {
            const normalized = normalizeName(key);
            return (
                normalized.includes("ADI SOYADI") ||
                normalized.includes("AD SOYAD") ||
                normalized.includes("PERSONEL")
            );
        }) || null
    );
}

function detectTutarColumn(row) {
    const possibleNames = [
        "Brüt Aylık",
        "BRÜT AYLIK",
        "Brüt Ücret",
        "Tutar",
        "Net Ücret",
        "Maaş",
        "Toplam",
        "Ücret",
    ];

    const found = possibleNames.find(
        (key) => row[key] !== undefined && String(row[key] || "").trim() !== ""
    );
    if (found) return found;

    const keys = Object.keys(row).filter((k) => !k.startsWith("_"));
    return keys.find((key) => toNumberTR(row[key]) > 0) || null;
}

const UploadIcon = () => (
    <svg viewBox="0 0 24 24">
        <polyline points="16 16 12 12 8 16" />
        <line x1="12" y1="12" x2="12" y2="21" />
        <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
);

const FileIcon = () => (
    <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

function AlertModal({ open, type = "info", title, message, onClose }) {
    if (!open) return null;

    const icons = { success: "✓", error: "✕", warning: "!", info: "i" };

    return (
        <div className="ik-modal-overlay" onClick={onClose}>
            <div
                className={`ik-modal ik-modal-${type}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="ik-modal-icon">{icons[type]}</div>
                <div className="ik-modal-content">
                    <h3 className="ik-modal-title">{title}</h3>
                    <p className="ik-modal-message">{message}</p>
                </div>
                <div className="ik-modal-actions">
                    <button className="ik-modal-button" onClick={onClose}>
                        Tamam
                    </button>
                </div>
            </div>
        </div>
    );
}

function getFixedCostInitialState() {
    return {
        kira_kadir: "",
        kira_mahmut: "",
        akaryakit_kadir: "",
        akaryakit_mahmut: "",
        hgs_kadir: "",
        hgs_mahmut: "",
    };
}

export default function InsanKaynaklariSayfasi() {
    const today = new Date();

    const [dragActive, setDragActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [fixedSaving, setFixedSaving] = useState(false);
    const [excelData, setExcelData] = useState(null);
    const [error, setError] = useState("");
    const [users, setUsers] = useState([]);
    const [expandedRows, setExpandedRows] = useState({});
    const [projeData, setProjeData] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(
        String(today.getMonth() + 1).padStart(2, "0")
    );
    const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
    const [fixedCostSummary, setFixedCostSummary] = useState(null);
    const [fixedCostForm, setFixedCostForm] = useState(getFixedCostInitialState());
    const [modalState, setModalState] = useState({
        open: false,
        type: "info",
        title: "",
        message: "",
    });

    const showModal = useCallback((type, title, message) => {
        setModalState({ open: true, type, title, message });
    }, []);

    const closeModal = useCallback(() => {
        setModalState((prev) => ({ ...prev, open: false }));
    }, []);

    const loadUsers = useCallback(async () => {
        const { data, error: usersError } = await supabase
            .from("kullanicilar")
            .select("id, kullanici_adi")
            .order("kullanici_adi");

        if (usersError) {
            console.error(usersError);
            setError("Kullanıcılar alınırken hata oluştu.");
            return;
        }

        setUsers(data || []);
    }, []);

    const loadProjeDagilim = useCallback(async () => {
        const ay = Number(selectedMonth);
        const yil = Number(selectedYear);

        const { data, error: projeError } = await supabase
            .from("proje_dagilim_yeni")
            .select("kullanici_adi, hesap_adi, alt_kalem, tutar, donem_ay, donem_yil, proje_id")
            .eq("donem_ay", ay)
            .eq("donem_yil", yil);

        if (projeError) {
            console.error(projeError);
            return;
        }

        setProjeData(data || []);
        setExpandedRows({});
    }, [selectedMonth, selectedYear]);

    const loadFixedCosts = useCallback(async () => {
        const ay = Number(selectedMonth);
        const yil = Number(selectedYear);

        const { data, error: fixedError } = await supabase
            .from("vw_sabit_maliyetler_ozet")
            .select("*")
            .eq("donem_yil", yil)
            .eq("donem_ay", ay)
            .maybeSingle();

        if (fixedError) {
            console.error(fixedError);
            return;
        }

        const summary = data || null;
        setFixedCostSummary(summary);

        setFixedCostForm({
            kira_kadir: summary?.kira_kadir ?? "",
            kira_mahmut: summary?.kira_mahmut ?? "",
            akaryakit_kadir: summary?.akaryakit_kadir ?? "",
            akaryakit_mahmut: summary?.akaryakit_mahmut ?? "",
            hgs_kadir: summary?.hgs_kadir ?? "",
            hgs_mahmut: summary?.hgs_mahmut ?? "",
        });
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        loadFixedCosts();
        loadProjeDagilim();
    }, [loadFixedCosts, loadProjeDagilim]);

    const handleFixedInputChange = (field, value) => {
        setFixedCostForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const toggleRow = (key) => {
        setExpandedRows((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleFile = useCallback(
        async (file) => {
            if (!file) return;

            const fileName = file.name.toLowerCase();
            if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
                setError("Lütfen .xlsx veya .xls uzantılı bir Excel dosyası yükleyin.");
                setExcelData(null);
                return;
            }

            setLoading(true);
            setError("");

            try {
                const parsed = await parseExcelFile(file);
                setExcelData(parsed);
                showModal("success", "Dosya Yüklendi", `${file.name} başarıyla okundu.`);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Bir hata oluştu.");
                setExcelData(null);
            } finally {
                setLoading(false);
            }
        },
        [showModal]
    );

    const onDrop = useCallback(
        async (event) => {
            event.preventDefault();
            setDragActive(false);
            const file = event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) await handleFile(file);
        },
        [handleFile]
    );

    const headers = useMemo(() => excelData?.headers || [], [excelData]);

    const dataHeaders = useMemo(
        () => headers.filter((h) => !String(h).startsWith("_")),
        [headers]
    );

    const userMap = useMemo(() => {
        const map = new Map();
        users.forEach((user) => map.set(normalizeName(user.kullanici_adi), user));
        return map;
    }, [users]);

    const processedRows = useMemo(() => {
        if (!excelData?.rows?.length) return [];

        return excelData.rows.map((row) => {
            const adSoyadColumn = detectAdSoyadColumn(row);
            const tutarColumn = detectTutarColumn(row);
            const excelAdSoyad = adSoyadColumn
                ? String(row[adSoyadColumn] || "").trim()
                : "";
            const matchedUser = userMap.get(normalizeName(excelAdSoyad)) || null;

            return {
                ...row,
                _adSoyadColumn: adSoyadColumn,
                _tutarColumn: tutarColumn,
                _excelAdSoyad: excelAdSoyad,
                _brutAylik: tutarColumn ? toNumberTR(row[tutarColumn]) : 0,
                _matchedUser: matchedUser,
                _matchedUserId: matchedUser?.id || null,
                _matchedUserName: matchedUser?.kullanici_adi || "",
            };
        });
    }, [excelData, userMap]);

    const toplamTutar = useMemo(() => {
        return processedRows.reduce((sum, row) => {
            return sum + (row._tutarColumn ? toNumberTR(row[row._tutarColumn]) : 0);
        }, 0);
    }, [processedRows]);

    const eslesenKayitSayisi = useMemo(
        () => processedRows.filter((r) => r._matchedUserId).length,
        [processedRows]
    );

    const eslesmeyenKayitSayisi = useMemo(
        () => processedRows.filter((r) => r._excelAdSoyad && !r._matchedUserId).length,
        [processedRows]
    );

    const selectedMonthLabel =
        monthOptions.find((m) => m.value === selectedMonth)?.label || "Ay seçiniz";

    const fixedCostCalculated = useMemo(() => {
        const kiraKadir = toNumberTR(fixedCostForm.kira_kadir);
        const kiraMahmut = toNumberTR(fixedCostForm.kira_mahmut);
        const akaryakitKadir = toNumberTR(fixedCostForm.akaryakit_kadir);
        const akaryakitMahmut = toNumberTR(fixedCostForm.akaryakit_mahmut);
        const hgsKadir = toNumberTR(fixedCostForm.hgs_kadir);
        const hgsMahmut = toNumberTR(fixedCostForm.hgs_mahmut);

        return {
            kiraKadir,
            kiraMahmut,
            kiraToplam: kiraKadir + kiraMahmut,
            akaryakitKadir,
            akaryakitMahmut,
            yakitToplam: akaryakitKadir + akaryakitMahmut,
            hgsKadir,
            hgsMahmut,
            gecisToplam: hgsKadir + hgsMahmut,
            genelToplam:
                kiraKadir +
                kiraMahmut +
                akaryakitKadir +
                akaryakitMahmut +
                hgsKadir +
                hgsMahmut,
        };
    }, [fixedCostForm]);

    const groupedProje = useMemo(() => {
        const groups = {};

        projeData.forEach((item) => {
            // Sadece sabit maliyetin proje bazlı dağıtılmış satırlarını
            // üst özetten çıkar. İK ve diğerlerini bozma.
            if (item.hesap_adi === "SABİT MALİYET" && item.proje_id !== null) {
                return;
            }

            const key = item.alt_kalem || item.hesap_adi || "Diğer";

            if (!groups[key]) {
                groups[key] = {
                    toplam: 0,
                    detaylar: [],
                };
            }

            groups[key].toplam += Number(item.tutar || 0);
            groups[key].detaylar.push(item);
        });

        return groups;
    }, [projeData]);
    const fixedCostChanged = useMemo(() => {
        if (!fixedCostSummary) {
            return Object.values(fixedCostForm).some(
                (value) => String(value).trim() !== ""
            );
        }

        return (
            toNumberTR(fixedCostForm.kira_kadir) !==
            toNumberTR(fixedCostSummary.kira_kadir) ||
            toNumberTR(fixedCostForm.kira_mahmut) !==
            toNumberTR(fixedCostSummary.kira_mahmut) ||
            toNumberTR(fixedCostForm.akaryakit_kadir) !==
            toNumberTR(fixedCostSummary.akaryakit_kadir) ||
            toNumberTR(fixedCostForm.akaryakit_mahmut) !==
            toNumberTR(fixedCostSummary.akaryakit_mahmut) ||
            toNumberTR(fixedCostForm.hgs_kadir) !==
            toNumberTR(fixedCostSummary.hgs_kadir) ||
            toNumberTR(fixedCostForm.hgs_mahmut) !==
            toNumberTR(fixedCostSummary.hgs_mahmut)
        );
    }, [fixedCostForm, fixedCostSummary]);

    const saveIkRows = async () => {
        if (!selectedMonth) {
            showModal("warning", "Ay Seçilmedi", "Lütfen hangi ayın verisi olduğunu seçin.");
            return;
        }

        if (!processedRows.length) {
            showModal("warning", "Veri Bulunamadı", "Kaydedilecek veri yok.");
            return;
        }

        const missingUsers = processedRows.filter(
            (row) => row._excelAdSoyad && !row._matchedUserId
        );

        if (missingUsers.length > 0) {
            showModal(
                "error",
                "Eşleşmeyen Kullanıcılar Var",
                `Kullanıcı tablosunda eşleşmeyen ${missingUsers.length} kayıt var. Önce kullanıcı adlarını kontrol et.`
            );
            return;
        }

        const preparedRows = processedRows
            .map((row) => ({
                kullanici_id: row._matchedUserId,
                hesap_adi: "PERSONEL GİDERİ",
                tutar: row._tutarColumn ? toNumberTR(row[row._tutarColumn]) : 0,
                donem_ayi: selectedMonth,
                donem_yil: Number(selectedYear),
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            }))
            .filter((item) => item.kullanici_id && item.hesap_adi && item.tutar > 0);

        try {
            setSaving(true);

            // önce eski proje bazlı İK dağıtımlarını temizle
            const { error: deleteProjectRowsError } = await supabase
                .from("ik")
                .delete()
                .eq("donem_ayi", selectedMonth)
                .eq("donem_yil", Number(selectedYear))
                .not("proje_id", "is", null);

            if (deleteProjectRowsError) {
                console.error(deleteProjectRowsError);
                showModal("error", "Kayıt Başarısız", "Eski İK proje dağıtımları silinemedi.");
                return;
            }

            // ham kullanıcı kayıtlarını güncelle / ekle
            // önce aynı dönemin ham İK kayıtlarını temizle
            const { error: deleteBaseRowsError } = await supabase
                .from("ik")
                .delete()
                .eq("donem_ayi", selectedMonth)
                .is("donem_yil", null)
                .is("proje_id", null)
                .eq("hesap_adi", "PERSONEL GİDERİ");

            if (deleteBaseRowsError) {
                console.error(deleteBaseRowsError);
                showModal("error", "Kayıt Başarısız", "Eski ham İK kayıtları silinemedi.");
                return;
            }

            // ham kullanıcı kayıtlarını yeniden ekle
            const { error: insertBaseRowsError } = await supabase
                .from("ik")
                .insert(
                    preparedRows.map((row) => ({
                        ...row,
                        donem_yil: null, // mevcut view yapınla uyumlu kalsın
                    }))
                );

            if (insertBaseRowsError) {
                console.error(insertBaseRowsError);
                showModal("error", "Kayıt Başarısız", "İK kayıtları kaydedilemedi.");
                return;
            }
            // proje bazlı dağıtımı oluştur
            await distributeIkRowsToProjects(preparedRows);

            await loadProjeDagilim();

            const label =
                monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth;

            showModal(
                "success",
                "Kayıt Başarılı",
                `${preparedRows.length} kayıt ik tablosuna kaydedildi ve projelere dağıtıldı. Dönem ayı: ${label}`
            );
        } catch (err) {
            console.error(err);
            showModal("error", "Sistem Hatası", "Kayıt sırasında hata oluştu.");
        } finally {
            setSaving(false);
        }
    };
    const distributeFixedCostsToProjects = async (costRows) => {
        const ay = Number(selectedMonth);
        const yil = Number(selectedYear);

        // 🔥 EKLENDİ: eski proje dağıtımlarını temizle
        await supabase
            .from("sabit_maliyetler")
            .delete()
            .eq("donem_yil", yil)
            .eq("donem_ay", ay)
            .not("proje_id", "is", null);

        const payload = [];

        for (const cost of costRows) {
            const anaTutar = Number(cost.tutar || 0);
            if (anaTutar <= 0) continue;

            const { data: dagilimlar, error: dagilimError } = await supabase
                .from("kullanici_proje_dagilim")
                .select("proje_id, dagilim_yuzde")
                .eq("kullanici_id", cost.kullanici_id);

            if (dagilimError) throw dagilimError;
            if (!dagilimlar || dagilimlar.length === 0) continue;

            let kalan = anaTutar;

            dagilimlar.forEach((item, index) => {
                const pct = Number(item.dagilim_yuzde || 0);
                let dagitilanTutar = 0;

                if (index === dagilimlar.length - 1) {
                    dagitilanTutar = Number(kalan.toFixed(2));
                } else {
                    dagitilanTutar = Number((anaTutar * (pct / 100)).toFixed(2));
                    kalan = Number((kalan - dagitilanTutar).toFixed(2));
                }

                if (dagitilanTutar <= 0) return;

                payload.push({
                    kullanici_id: cost.kullanici_id,
                    donem_yil: yil,
                    donem_ay: ay,
                    gider_tipi: cost.gider_tipi,
                    proje_id: item.proje_id,
                    dagilim_orani: pct,
                    asil_tutar: anaTutar,
                    tutar: dagitilanTutar,
                });
            });
        }

        if (payload.length > 0) {
            const { error: insertError } = await supabase
                .from("sabit_maliyetler")
                .insert(payload);

            if (insertError) {
                throw insertError;
            }
        }
    };

    const distributeIkRowsToProjects = async (ikRows) => {
        const ay = String(selectedMonth);
        const yil = Number(selectedYear);

        const payload = [];

        for (const row of ikRows) {
            const anaTutar = Number(row.tutar || 0);
            if (anaTutar <= 0) continue;

            const { data: dagilimlar, error: dagilimError } = await supabase
                .from("kullanici_proje_dagilim")
                .select("proje_id, dagilim_yuzde")
                .eq("kullanici_id", row.kullanici_id);

            if (dagilimError) throw dagilimError;
            if (!dagilimlar || dagilimlar.length === 0) continue;

            let kalan = anaTutar;

            dagilimlar.forEach((item, index) => {
                const pct = Number(item.dagilim_yuzde || 0);
                let dagitilanTutar = 0;

                if (index === dagilimlar.length - 1) {
                    dagitilanTutar = Number(kalan.toFixed(2));
                } else {
                    dagitilanTutar = Number((anaTutar * (pct / 100)).toFixed(2));
                    kalan = Number((kalan - dagitilanTutar).toFixed(2));
                }

                if (dagitilanTutar <= 0) return;

                payload.push({
                    kullanici_id: row.kullanici_id,
                    hesap_adi: row.hesap_adi,
                    tutar: dagitilanTutar,
                    donem_ayi: ay,
                    donem_yil: yil,
                    proje_id: item.proje_id,
                    dagilim_orani: pct,
                    asil_tutar: anaTutar,
                });
            });
        }

        if (payload.length > 0) {
            console.log("IK dağıtım payload:", payload);

            const { data, error: insertError } = await supabase
                .from("ik")
                .insert(payload)
                .select();

            console.log("IK insert sonucu:", data);
            console.log("IK insert hata:", insertError);

            if (insertError) {
                console.error("IK INSERT HATASI:", insertError);
                throw insertError;
            }
        }
    };

    const saveFixedCosts = async () => {
        if (!selectedMonth || !selectedYear) {
            showModal("warning", "Dönem Eksik", "Ay ve yıl seçiniz.");
            return;
        }

        const kadirUser = users.find(
            (u) => normalizeName(u.kullanici_adi) === "KADİR ŞAHİN"
        );

        const mahmutUser = users.find(
            (u) => normalizeName(u.kullanici_adi) === "MAHMUT İNALKAÇ"
        );

        if (!kadirUser || !mahmutUser) {
            showModal(
                "error",
                "Kullanıcı Bulunamadı",
                "Kullanicilar tablosunda Kadir ve Mahmut kayıtları olmalı."
            );
            return;
        }

        if (!fixedCostChanged) {
            showModal(
                "info",
                "Değişiklik Yok",
                "Bu ay için sabit maliyetlerde değişiklik olmadığı için kayıt yapılmadı."
            );
            return;
        }

        const rows = [
            {
                kullanici_id: kadirUser.id,
                donem_yil: Number(selectedYear),
                donem_ay: Number(selectedMonth),
                gider_tipi: "KIRA_BEDELI",
                tutar: fixedCostCalculated.kiraKadir,
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            },
            {
                kullanici_id: mahmutUser.id,
                donem_yil: Number(selectedYear),
                donem_ay: Number(selectedMonth),
                gider_tipi: "KIRA_BEDELI",
                tutar: fixedCostCalculated.kiraMahmut,
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            },
            {
                kullanici_id: kadirUser.id,
                donem_yil: Number(selectedYear),
                donem_ay: Number(selectedMonth),
                gider_tipi: "AKARYAKIT",
                tutar: fixedCostCalculated.akaryakitKadir,
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            },
            {
                kullanici_id: mahmutUser.id,
                donem_yil: Number(selectedYear),
                donem_ay: Number(selectedMonth),
                gider_tipi: "AKARYAKIT",
                tutar: fixedCostCalculated.akaryakitMahmut,
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            },
            {
                kullanici_id: kadirUser.id,
                donem_yil: Number(selectedYear),
                donem_ay: Number(selectedMonth),
                gider_tipi: "HGS",
                tutar: fixedCostCalculated.hgsKadir,
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            },
            {
                kullanici_id: mahmutUser.id,
                donem_yil: Number(selectedYear),
                donem_ay: Number(selectedMonth),
                gider_tipi: "HGS",
                tutar: fixedCostCalculated.hgsMahmut,
                proje_id: null,
                dagilim_orani: null,
                asil_tutar: null,
            },
        ];
        try {
            setFixedSaving(true);

            const { error: upsertError } = await supabase
                .from("sabit_maliyetler")
                .upsert(rows, {
                    onConflict: "kullanici_id,donem_yil,donem_ay,gider_tipi,proje_id",
                });
            if (upsertError) {
                console.error(upsertError);
                showModal("error", "Kayıt Başarısız", "Sabit maliyetler kaydedilemedi.");
                return;
            }

            await distributeFixedCostsToProjects(rows);
            await loadFixedCosts();
            await loadProjeDagilim();

            showModal(
                "success",
                "Sabit Maliyetler Kaydedildi",
                `${selectedMonthLabel} ${selectedYear} dönemi için sabit maliyetler kaydedildi, oranlara göre projelere dağıtıldı.`
            );
        } catch (err) {
            console.error(err);
            showModal("error", "Sistem Hatası", "Kayıt sırasında hata oluştu.");
        } finally {
            setFixedSaving(false);
        }
    };

    return (
        <>
            <div className="ik-sayfa">
                <div className="ik-konteyner">
                    <div className="ik-sade-ustbar">
                        <div className="ik-sade-filtreler">
                            <select
                                className="ik-ay-modern-select"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                disabled={saving || fixedSaving}
                            >
                                {monthOptions.map((month) => (
                                    <option key={month.value} value={month.value}>
                                        {month.label}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="ik-ay-modern-select"
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                disabled={saving || fixedSaving}
                            >
                                {yearOptions.map((year) => (
                                    <option key={year} value={year}>
                                        {year}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            className="ik-kaydet-buton"
                            onClick={saveIkRows}
                            disabled={saving || !processedRows.length}
                        >
                            {saving ? "Kaydediliyor..." : "İK Tablosuna Kaydet"}
                        </button>
                    </div>

                    <div
                        onDragOver={(e) => {
                            e.preventDefault();
                            setDragActive(true);
                        }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={onDrop}
                        className={`ik-drop-alani${dragActive ? " aktif" : ""}`}
                    >
                        <div className="ik-drop-icerik">
                            <div className="ik-upload-icon">
                                <UploadIcon />
                            </div>
                            <p className="ik-drop-yazi">Excel dosyasını buraya bırak</p>
                            <p className="ik-drop-alt-yazi">
                                veya aşağıdaki butondan dosya seçerek yükle
                            </p>
                            <div className="ik-drop-formatlar">
                                <span className="ik-format-tag">.xlsx</span>
                                <span className="ik-format-tag">.xls</span>
                            </div>
                            <label className="ik-dosya-buton">
                                <FileIcon /> Dosya Seç
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="ik-dosya-input"
                                    onChange={async (e) => {
                                        const file = e.target.files && e.target.files[0];
                                        if (file) await handleFile(file);
                                        e.target.value = "";
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    {loading && <div className="ik-yukleniyor">Excel dosyası okunuyor...</div>}
                    {error && <div className="ik-hata">{error}</div>}

                    {excelData && (
                        <div className="ik-kart">
                            <div className="ik-kart-baslik-satir">
                                <h2 className="ik-kart-baslik">İK Aktarım Listesi</h2>
                                <span className="ik-kart-badge">
                                    {processedRows.length} kayıt / {formatMoney(toplamTutar)}
                                </span>
                            </div>

                            <div className="ik-ozet-satir">
                                <div className="ik-mini-bilgi">
                                    <span>Dosya</span>
                                    <strong>{excelData.fileName}</strong>
                                </div>
                                <div className="ik-mini-bilgi">
                                    <span>Sheet</span>
                                    <strong>{excelData.sheetName}</strong>
                                </div>
                                <div className="ik-mini-bilgi">
                                    <span>Eşleşen</span>
                                    <strong>{eslesenKayitSayisi}</strong>
                                </div>
                                <div className="ik-mini-bilgi">
                                    <span>Eşleşmeyen</span>
                                    <strong>{eslesmeyenKayitSayisi}</strong>
                                </div>
                            </div>

                            <div className="ik-tablo-wrapper">
                                <table className="ik-tablo">
                                    <thead>
                                        <tr>
                                            <th>Eşleşen Kullanıcı</th>
                                            <th>Durum</th>
                                            <th>Adı Soyadı</th>
                                            <th>Brüt Aylık</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {processedRows.length > 0 ? (
                                            processedRows.map((row, rowIndex) => (
                                                <tr key={row._rowId || rowIndex}>
                                                    <td>{row._matchedUserName || "—"}</td>
                                                    <td>
                                                        {row._matchedUserId ? (
                                                            <span className="ik-eslesme-basarili">
                                                                Eşleşti
                                                            </span>
                                                        ) : (
                                                            <span className="ik-eslesme-hata">
                                                                Eşleşmedi
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td>{row._excelAdSoyad || "—"}</td>
                                                    <td>
                                                        {row._tutarColumn
                                                            ? formatMoney(toNumberTR(row[row._tutarColumn]))
                                                            : "—"}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="ik-bos-veri">
                                                    Gösterilecek veri bulunamadı.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {excelData.summaryRow && (
                                <div className="ik-alt-ozet">
                                    <div className="ik-tablo-wrapper">
                                        <table className="ik-tablo">
                                            <thead>
                                                <tr>
                                                    <th>Adı Soyadı</th>
                                                    <th>Brüt Aylık</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr>
                                                    <td>{excelData.summaryRow[detectAdSoyadColumn(excelData.summaryRow)] || ""}</td>
                                                    <td>
                                                        {(() => {
                                                            const tutarColumn = detectTutarColumn(excelData.summaryRow);
                                                            return tutarColumn
                                                                ? formatMoney(toNumberTR(excelData.summaryRow[tutarColumn]))
                                                                : "";
                                                        })()}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="ik-kart">
                        <div className="ik-kart-baslik-satir">
                            <h2 className="ik-kart-baslik">Proje Dağılım Özeti</h2>
                            <span className="ik-kart-badge">
                                {selectedMonthLabel} {selectedYear}
                            </span>
                        </div>

                        <div className="ik-tablo-wrapper">
                            <table className="ik-tablo">
                                <thead>
                                    <tr>
                                        <th>Açıklama</th>
                                        <th>Tutar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(groupedProje).length > 0 ? (
                                        Object.entries(groupedProje).map(([key, value]) => (
                                            <React.Fragment key={key}>
                                                <tr
                                                    onClick={() => toggleRow(key)}
                                                    style={{ cursor: "pointer", fontWeight: 600 }}
                                                >
                                                    <td>
                                                        {expandedRows[key] ? "▼" : "▶"} {key}
                                                    </td>
                                                    <td>{formatMoney(value.toplam)}</td>
                                                </tr>

                                                {expandedRows[key] &&
                                                    value.detaylar.map((item, i) => (
                                                        <tr key={`${key}-${i}`}>
                                                            <td style={{ paddingLeft: "30px" }}>
                                                                {item.kullanici_adi || "—"} -{" "}
                                                                {item.hesap_adi || item.alt_kalem || "Detay"}
                                                            </td>
                                                            <td>{formatMoney(item.tutar)}</td>
                                                        </tr>
                                                    ))}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={2} className="ik-bos-veri">
                                                Bu dönem için proje dağılım verisi bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="ik-kart">
                        <div className="ik-kart-baslik-satir">
                            <h2 className="ik-kart-baslik">Sabit Maliyetler</h2>
                            <span className="ik-kart-badge">
                                {selectedMonthLabel} {selectedYear}
                            </span>
                        </div>

                        <div className="ik-fixed-form-grid">
                            <div className="ik-fixed-input-card">
                                <label>Kira Bedeli_Kadir</label>
                                <input
                                    type="text"
                                    value={fixedCostForm.kira_kadir}
                                    onChange={(e) =>
                                        handleFixedInputChange("kira_kadir", e.target.value)
                                    }
                                    placeholder="0"
                                />
                            </div>

                            <div className="ik-fixed-input-card">
                                <label>Kira Bedeli_Mahmut</label>
                                <input
                                    type="text"
                                    value={fixedCostForm.kira_mahmut}
                                    onChange={(e) =>
                                        handleFixedInputChange("kira_mahmut", e.target.value)
                                    }
                                    placeholder="0"
                                />
                            </div>

                            <div className="ik-fixed-input-card">
                                <label>Akaryakıt_Kadir</label>
                                <input
                                    type="text"
                                    value={fixedCostForm.akaryakit_kadir}
                                    onChange={(e) =>
                                        handleFixedInputChange("akaryakit_kadir", e.target.value)
                                    }
                                    placeholder="0"
                                />
                            </div>

                            <div className="ik-fixed-input-card">
                                <label>Akaryakıt_Mahmut</label>
                                <input
                                    type="text"
                                    value={fixedCostForm.akaryakit_mahmut}
                                    onChange={(e) =>
                                        handleFixedInputChange("akaryakit_mahmut", e.target.value)
                                    }
                                    placeholder="0"
                                />
                            </div>

                            <div className="ik-fixed-input-card">
                                <label>HGS_Kadir</label>
                                <input
                                    type="text"
                                    value={fixedCostForm.hgs_kadir}
                                    onChange={(e) =>
                                        handleFixedInputChange("hgs_kadir", e.target.value)
                                    }
                                    placeholder="0"
                                />
                            </div>

                            <div className="ik-fixed-input-card">
                                <label>HGS_Mahmut</label>
                                <input
                                    type="text"
                                    value={fixedCostForm.hgs_mahmut}
                                    onChange={(e) =>
                                        handleFixedInputChange("hgs_mahmut", e.target.value)
                                    }
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div className="ik-fixed-actions">
                            <button
                                className="ik-kaydet-buton"
                                onClick={saveFixedCosts}
                                disabled={fixedSaving}
                            >
                                {fixedSaving
                                    ? "Kaydediliyor..."
                                    : fixedCostSummary
                                        ? "Sabit Maliyetleri Güncelle"
                                        : "Sabit Maliyetleri Kaydet"}
                            </button>
                        </div>

                        <table className="ik-tablo ik-modern-tablo">
                            <thead>
                                <tr>
                                    <th colSpan="2" className="ik-baslik">
                                        Şirket Araçları_{selectedMonthLabel} {selectedYear} İdari İşler
                                    </th>
                                </tr>
                                <tr>
                                    <th>Açıklama</th>
                                    <th>Tutar</th>
                                </tr>
                            </thead>

                            <tbody>
                                <tr className="ik-grup">
                                    <td colSpan="2">Kira Giderleri</td>
                                </tr>
                                <tr>
                                    <td>Kadir</td>
                                    <td>{formatMoney(fixedCostCalculated.kiraKadir)}</td>
                                </tr>
                                <tr>
                                    <td>Mahmut</td>
                                    <td>{formatMoney(fixedCostCalculated.kiraMahmut)}</td>
                                </tr>
                                <tr className="ik-toplam">
                                    <td>Kira Toplam</td>
                                    <td>{formatMoney(fixedCostCalculated.kiraToplam)}</td>
                                </tr>

                                <tr className="ik-grup">
                                    <td colSpan="2">Akaryakıt</td>
                                </tr>
                                <tr>
                                    <td>Kadir</td>
                                    <td>{formatMoney(fixedCostCalculated.akaryakitKadir)}</td>
                                </tr>
                                <tr>
                                    <td>Mahmut</td>
                                    <td>{formatMoney(fixedCostCalculated.akaryakitMahmut)}</td>
                                </tr>
                                <tr className="ik-toplam">
                                    <td>Yakıt Toplam</td>
                                    <td>{formatMoney(fixedCostCalculated.yakitToplam)}</td>
                                </tr>

                                <tr className="ik-grup">
                                    <td colSpan="2">HGS / Geçiş</td>
                                </tr>
                                <tr>
                                    <td>Kadir</td>
                                    <td>{formatMoney(fixedCostCalculated.hgsKadir)}</td>
                                </tr>
                                <tr>
                                    <td>Mahmut</td>
                                    <td>{formatMoney(fixedCostCalculated.hgsMahmut)}</td>
                                </tr>
                                <tr className="ik-toplam">
                                    <td>Geçiş Ücreti Toplam</td>
                                    <td>{formatMoney(fixedCostCalculated.gecisToplam)}</td>
                                </tr>

                                <tr className="ik-genel">
                                    <td>Genel Toplam</td>
                                    <td>{formatMoney(fixedCostCalculated.genelToplam)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <AlertModal
                open={modalState.open}
                type={modalState.type}
                title={modalState.title}
                message={modalState.message}
                onClose={closeModal}
            />
        </>
    );
}