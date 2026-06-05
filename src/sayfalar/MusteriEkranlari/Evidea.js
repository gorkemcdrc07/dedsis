import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./Evidea.css";

const MUSTERI_ADI = "Evidea";

const kolonlar = [
    "Yükleme Tarihi",
    "Yükleme Yeri",
    "Planlanan Yükleme Saati",
    "Plaka",
    "Sürücü Adı Soyadı",
    "İletişim",
    "Uğrama Yeri 1",
    "Uğrama Yeri 2",
    "Varış Noktası",
    "Planlanan Teslim Tarihi",
    "Planlanan Teslim Saati",
    "Seyir Durumu",
    "Gerçekleşen Teslim Tarihi",
    "Gerçekleşen Teslim Saati",
];

const seyirDurumuSecenekleri = [
    "Yolda",
    "Teslim Noktasında",
    "Beklemede",
    "Teslim Edildi",
    "İade Alındı",
];

const bosSatirOlustur = () =>
    kolonlar.reduce((acc, kolon) => {
        acc[kolon] = "";
        return acc;
    }, {});

const bugun = () => new Date().toISOString().split("T")[0];

const tarihAraligi = (tarih) => {
    const baslangic = new Date(`${tarih}T00:00:00`);
    const bitis = new Date(`${tarih}T23:59:59.999`);

    return {
        baslangic: baslangic.toISOString(),
        bitis: bitis.toISOString(),
    };
};

const supabaseVerisindenSatiraDonustur = (item) => ({
    "Yükleme Tarihi": item.yukleme_tarihi || "",
    "Yükleme Yeri": item.yukleme_yeri || "",
    "Planlanan Yükleme Saati": item.planlanan_yukleme_saati || "",
    "Plaka": item.plaka || "",
    "Sürücü Adı Soyadı": item.surucu_adi_soyadi || "",
    "İletişim": item.iletisim || "",
    "Uğrama Yeri 1": item.ugrma_yeri_1 || "",
    "Uğrama Yeri 2": item.ugrma_yeri_2 || "",
    "Varış Noktası": item.varis_noktasi || "",
    "Planlanan Teslim Tarihi": item.planlanan_teslim_tarihi || "",
    "Planlanan Teslim Saati": item.planlanan_teslim_saati || "",
    "Seyir Durumu": item.seyir_durumu || "",
    "Gerçekleşen Teslim Tarihi": item.gerceklesen_teslim_tarihi || "",
    "Gerçekleşen Teslim Saati": item.gerceklesen_teslim_saati || "",
});

const satirdanSupabaseVerisineDonustur = (satir) => ({
    musteri_adi: MUSTERI_ADI,
    yukleme_tarihi: satir["Yükleme Tarihi"] || null,
    yukleme_yeri: satir["Yükleme Yeri"] || null,
    planlanan_yukleme_saati: satir["Planlanan Yükleme Saati"] || null,
    plaka: satir["Plaka"] || null,
    surucu_adi_soyadi: satir["Sürücü Adı Soyadı"] || null,
    iletisim: satir["İletişim"] || null,
    ugrma_yeri_1: satir["Uğrama Yeri 1"] || null,
    ugrma_yeri_2: satir["Uğrama Yeri 2"] || null,
    varis_noktasi: satir["Varış Noktası"] || null,
    planlanan_teslim_tarihi: satir["Planlanan Teslim Tarihi"] || null,
    planlanan_teslim_saati: satir["Planlanan Teslim Saati"] || null,
    seyir_durumu: satir["Seyir Durumu"] || null,
    gerceklesen_teslim_tarihi: satir["Gerçekleşen Teslim Tarihi"] || null,
    gerceklesen_teslim_saati: satir["Gerçekleşen Teslim Saati"] || null,
});

export default function Evidea() {
    const [satirlar, setSatirlar] = useState([bosSatirOlustur()]);
    const [secilenTarih, setSecilenTarih] = useState(bugun());
    const [kaydediliyor, setKaydediliyor] = useState(false);
    const [yukleniyor, setYukleniyor] = useState(false);

    const verileriGetir = useCallback(async (tarih = secilenTarih) => {
        try {
            setYukleniyor(true);

            const { baslangic, bitis } = tarihAraligi(tarih);

            const { data, error } = await supabase
                .from("musteri_teslimat_kayitlari")
                .select("*")
                .eq("musteri_adi", MUSTERI_ADI)
                .gte("created_at", baslangic)
                .lte("created_at", bitis)
                .order("id", { ascending: true });

            if (error) {
                console.error(error);
                alert("Kayıtlar getirilirken hata oluştu");
                return;
            }

            setSatirlar(
                data && data.length > 0
                    ? data.map(supabaseVerisindenSatiraDonustur)
                    : [bosSatirOlustur()]
            );
        } catch (err) {
            console.error(err);
            alert("Beklenmeyen bir hata oluştu");
        } finally {
            setYukleniyor(false);
        }
    }, [secilenTarih]);

    useEffect(() => {
        verileriGetir(secilenTarih);
    }, [secilenTarih, verileriGetir]);

    const yeniSatirEkle = () => {
        setSatirlar((prev) => [...prev, bosSatirOlustur()]);
    };

    const satirSil = (index) => {
        setSatirlar((prev) => prev.filter((_, i) => i !== index));
    };

    const veriDegistir = (index, kolon, deger) => {
        setSatirlar((prev) =>
            prev.map((satir, i) =>
                i === index ? { ...satir, [kolon]: deger } : satir
            )
        );
    };

    const kaydet = async () => {
        try {
            setKaydediliyor(true);

            const veriler = satirlar.map(satirdanSupabaseVerisineDonustur);

            const { error } = await supabase
                .from("musteri_teslimat_kayitlari")
                .insert(veriler);

            if (error) {
                console.error(error);
                alert("Kayıt sırasında hata oluştu");
                return;
            }

            alert("Kayıt başarıyla eklendi");
            verileriGetir(secilenTarih);
        } catch (err) {
            console.error(err);
            alert("Beklenmeyen bir hata oluştu");
        } finally {
            setKaydediliyor(false);
        }
    };

    return (
        <div className="evidea-page">
            <div className="evidea-header">
                <div>
                    <h1>Evidea Operasyon Ekranı</h1>
                    <p>
                        {yukleniyor
                            ? "Kayıtlar yükleniyor..."
                            : "Seçilen tarihe ait kayıtları görüntüleyin ve yeni kayıt ekleyin."}
                    </p>
                </div>

                <div className="evidea-actions">
                    <label className="evidea-date-filter">
                        <span>Kayıt Tarihi</span>
                        <input
                            type="date"
                            value={secilenTarih}
                            onChange={(e) => setSecilenTarih(e.target.value)}
                        />
                    </label>

                    <button className="evidea-add-button" onClick={yeniSatirEkle}>
                        + Yeni Değer Ekle
                    </button>

                    <button
                        className="evidea-save-button"
                        onClick={kaydet}
                        disabled={kaydediliyor}
                    >
                        {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                </div>
            </div>

            <div className="evidea-card">
                <div className="evidea-table-wrapper">
                    <table className="evidea-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                {kolonlar.map((kolon) => (
                                    <th key={kolon}>{kolon}</th>
                                ))}
                                <th>İşlem</th>
                            </tr>
                        </thead>

                        <tbody>
                            {satirlar.map((satir, index) => (
                                <tr key={index}>
                                    <td className="evidea-row-number">{index + 1}</td>

                                    {kolonlar.map((kolon) => (
                                        <td key={kolon}>
                                            {kolon === "Seyir Durumu" ? (
                                                <select
                                                    value={satir[kolon]}
                                                    onChange={(e) =>
                                                        veriDegistir(index, kolon, e.target.value)
                                                    }
                                                >
                                                    <option value="">Seçiniz</option>

                                                    {seyirDurumuSecenekleri.map((secenek) => (
                                                        <option key={secenek} value={secenek}>
                                                            {secenek}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    type={
                                                        kolon.includes("Tarihi")
                                                            ? "date"
                                                            : kolon.includes("Saati")
                                                                ? "time"
                                                                : "text"
                                                    }
                                                    value={satir[kolon]}
                                                    onChange={(e) =>
                                                        veriDegistir(index, kolon, e.target.value)
                                                    }
                                                    placeholder={kolon}
                                                />
                                            )}
                                        </td>
                                    ))}

                                    <td>
                                        <button
                                            className="evidea-delete-button"
                                            onClick={() => satirSil(index)}
                                            disabled={satirlar.length === 1}
                                        >
                                            Sil
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}