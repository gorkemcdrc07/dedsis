import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    Download, Plus, Search, ArrowUpDown,
    Pencil, Ban, Trash2, Save, X, ChevronDown, ChevronRight,
    Check, Shield, Users, Activity, Zap, Command, Layers,
    AlertTriangle, UserCheck, UserX,
    Fingerprint, Grid3x3, Eye, Lock, Unlock
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const PALETTE = ["amber", "cyan", "violet", "emerald"];

const COLOR_MAP = {
    amber: { bg: "rgba(251,191,36,0.12)", border: "rgba(251,191,36,0.25)", text: "#fbbf24", dot: "#fbbf24" },
    cyan: { bg: "rgba(34,211,238,0.12)", border: "rgba(34,211,238,0.25)", text: "#22d3ee", dot: "#22d3ee" },
    violet: { bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.25)", text: "#a78bfa", dot: "#a78bfa" },
    emerald: { bg: "rgba(52,211,153,0.12)", border: "rgba(52,211,153,0.25)", text: "#34d399", dot: "#34d399" },
    kirmizi: { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", text: "#f87171", dot: "#f87171" },
};

const BOS_FORM = { id: null, kullanici_adi: "", kullanici: "", sifre: "" };

const avatarOlustur = (ad) => {
    if (!ad) return "KU";
    return ad.split(" ").map((k) => k[0]).join("").slice(0, 2).toUpperCase();
};

const satirDonustur = (u, index = 0) => ({
    id: u.id,
    ad: u.kullanici_adi || "İsimsiz",
    email: u.kullanici || "-",
    rol: "Kullanıcı",
    durum: u.durum || "aktif",
    giris: "Bilinmiyor",
    av: avatarOlustur(u.kullanici_adi),
    renk: PALETTE[index % PALETTE.length],
});

export default function YonetimPaneliSayfasi() {
    const [kullanicilar, setKullanicilar] = useState([]);
    const [arama, setArama] = useState("");
    const [sayfa, setSayfa] = useState(1);
    const [yukleniyor, setYukleniyor] = useState(true);
    const [hata, setHata] = useState("");
    const [islemde, setIslemde] = useState(false);

    const [seciliKullanici, setSeciliKullanici] = useState(null);
    const [acikEkranKodlari, setAcikEkranKodlari] = useState([]);
    const [acikOgeKodlari, setAcikOgeKodlari] = useState([]);
    const [yetkiler, setYetkiler] = useState({});

    const [ekranMap, setEkranMap] = useState({});
    const [ogeMap, setOgeMap] = useState({});
    const [alanMap, setAlanMap] = useState({});

    const [panelAcik, setPanelAcik] = useState(false);
    const [panelModu, setPanelModu] = useState("");
    const [panelKullanici, setPanelKullanici] = useState(null);
    const [formVerisi, setFormVerisi] = useState(BOS_FORM);

    const [ekranlar, setEkranlar] = useState([]);
    const [ekranOgeleri, setEkranOgeleri] = useState([]);
    const [ekranAlanlari, setEkranAlanlari] = useState([]);

    const [loglar, setLoglar] = useState([
        { mesaj: "Yönetim paneli açıldı", zaman: "Az önce", renk: "emerald" },
    ]);

    const [komutPaleti, setKomutPaleti] = useState(false);
    const [aktifSekme, setAktifSekme] = useState("yetki");
    const aramaRef = useRef(null);

    const logEkle = (mesaj, renk = "cyan") => {
        const saat = new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
        });
        setLoglar((prev) => [{ mesaj, zaman: saat, renk }, ...prev.slice(0, 9)]);
    };

    const paneliKapat = () => {
        setPanelAcik(false);
        setPanelModu("");
        setPanelKullanici(null);
        setFormVerisi(BOS_FORM);
    };

    const formDegistir = (alan, deger) => {
        setFormVerisi((prev) => ({ ...prev, [alan]: deger }));
    };

    const toggleEkranAcikligi = (kod) => {
        setAcikEkranKodlari((prev) =>
            prev.includes(kod) ? prev.filter((x) => x !== kod) : [...prev, kod]
        );
    };

    const toggleOgeAcikligi = (kod) => {
        setAcikOgeKodlari((prev) =>
            prev.includes(kod) ? prev.filter((x) => x !== kod) : [...prev, kod]
        );
    };

    const yetkiAnahtari = (ekranKod, ogeKod = null, alanKod = null) => {
        if (alanKod) return `${ekranKod}__${ogeKod}__${alanKod}`;
        if (ogeKod) return `${ekranKod}__${ogeKod}`;
        return ekranKod;
    };

    const ekranYetkiDurumu = (k) => !!yetkiler[yetkiAnahtari(k)];
    const ogeYetkiDurumu = (ek, og) => !!yetkiler[yetkiAnahtari(ek, og)];
    const alanYetkiDurumu = (ek, og, al) => !!yetkiler[yetkiAnahtari(ek, og, al)];

    const seciliKullaniciYetkileriniGetir = useCallback(async (kullaniciId) => {
        if (!kullaniciId) {
            setYetkiler({});
            return;
        }

        const { data, error } = await supabase
            .from("kullanici_yetkileri")
            .select(`
                id,
                aktif,
                ekran_id,
                ekran_ogesi_id,
                ekran_alani_id,
                ekranlar:ekran_id(id,kod),
                ekran_ogeleri:ekran_ogesi_id(id,kod),
                ekran_alanlari:ekran_alani_id(id,kod)
            `)
            .eq("kullanici_id", kullaniciId);

        if (error) {
            setHata("Yetkiler alınamadı.");
            return;
        }

        const yeni = {};
        (data || []).forEach((k) => {
            const ek = k.ekranlar?.kod;
            const og = k.ekran_ogeleri?.kod;
            const al = k.ekran_alanlari?.kod;
            if (!ek) return;
            yeni[yetkiAnahtari(ek, og, al)] = !!k.aktif;
        });

        setYetkiler(yeni);
    }, []);

    const referansTablolariHazirla = async () => {
        const { data: ekD, error: ekE } = await supabase
            .from("ekranlar")
            .select("id,kod,ad")
            .order("id", { ascending: true });

        if (ekE) {
            setHata("ekranlar okunamadı.");
            return false;
        }

        const ekranMapTmp = {};
        (ekD || []).forEach((e) => {
            ekranMapTmp[e.kod] = e.id;
        });
        setEkranMap(ekranMapTmp);
        setEkranlar(ekD || []);

        const { data: ogD, error: ogE } = await supabase
            .from("ekran_ogeleri")
            .select("id,kod,ad,ekran_id")
            .order("id", { ascending: true });

        if (ogE) {
            setHata("ekran_ogeleri okunamadı.");
            return false;
        }

        const ogeMapTmp = {};
        (ogD || []).forEach((o) => {
            ogeMapTmp[o.kod] = { id: o.id, ekran_id: o.ekran_id, ad: o.ad };
        });
        setOgeMap(ogeMapTmp);
        setEkranOgeleri(ogD || []);

        const { data: alD, error: alE } = await supabase
            .from("ekran_alanlari")
            .select("id,kod,ad,ekran_ogesi_id")
            .order("id", { ascending: true });

        if (alE) {
            setHata("ekran_alanlari okunamadı.");
            return false;
        }

        const alanMapTmp = {};
        (alD || []).forEach((a) => {
            alanMapTmp[a.kod] = {
                id: a.id,
                ekran_ogesi_id: a.ekran_ogesi_id,
                ad: a.ad,
            };
        });
        setAlanMap(alanMapTmp);
        setEkranAlanlari(alD || []);

        return true;
    };

    const ekranYapisi = useMemo(
        () =>
            ekranlar.map((ekran, i) => ({
                kod: ekran.kod,
                ad: ekran.ad,
                renk: PALETTE[i % PALETTE.length],
                ogeler: ekranOgeleri
                    .filter((o) => o.ekran_id === ekran.id)
                    .map((oge) => ({
                        kod: oge.kod,
                        ad: oge.ad,
                        alanlar: ekranAlanlari
                            .filter((a) => a.ekran_ogesi_id === oge.id)
                            .map((a) => ({ kod: a.kod, ad: a.ad })),
                    })),
            })),
        [ekranlar, ekranOgeleri, ekranAlanlari]
    );

    const kullanicilariGetir = async () => {
        setYukleniyor(true);
        setHata("");

        const { data, error } = await supabase
            .from("kullanicilar")
            .select("id,kullanici_adi,kullanici,sifre,durum")
            .order("id", { ascending: true });

        if (error) {
            setHata(error.message);
            setYukleniyor(false);
            return;
        }

        const list = (data || []).map((u, i) => satirDonustur(u, i));
        setKullanicilar(list);
        setSeciliKullanici((prev) =>
            prev ? list.find((k) => k.id === prev.id) || list[0] || null : list[0] || null
        );
        setYukleniyor(false);
    };

    useEffect(() => {
        (async () => {
            const ok = await referansTablolariHazirla();
            if (ok) await kullanicilariGetir();
        })();
    }, []);

    useEffect(() => {
        if (seciliKullanici?.id) seciliKullaniciYetkileriniGetir(seciliKullanici.id);
        else setYetkiler({});
    }, [seciliKullanici, seciliKullaniciYetkileriniGetir]);

    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setKomutPaleti((p) => !p);
            }
            if (e.key === "Escape") {
                setKomutPaleti(false);
                paneliKapat();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const filtrelenmis = useMemo(() => {
        const m = arama.toLowerCase();
        return kullanicilar.filter(
            (u) =>
                u.ad.toLowerCase().includes(m) ||
                u.email.toLowerCase().includes(m)
        );
    }, [kullanicilar, arama]);

    const PER_PAGE = 8;
    const toplamSayfa = Math.max(1, Math.ceil(filtrelenmis.length / PER_PAGE));
    const gosterilen = filtrelenmis.slice((sayfa - 1) * PER_PAGE, sayfa * PER_PAGE);

    useEffect(() => {
        if (ekranYapisi.length > 0 && acikEkranKodlari.length === 0) {
            setAcikEkranKodlari([ekranYapisi[0].kod]);
        }
    }, [ekranYapisi, acikEkranKodlari.length]);

    useEffect(() => {
        const oge = ekranYapisi[0]?.ogeler?.[0];
        if (oge && acikOgeKodlari.length === 0) {
            setAcikOgeKodlari([oge.kod]);
        }
    }, [ekranYapisi, acikOgeKodlari.length]);

    const yeniKullaniciPaneliAc = () => {
        setPanelModu("ekle");
        setPanelKullanici(null);
        setFormVerisi(BOS_FORM);
        setPanelAcik(true);
        logEkle("Yeni kullanıcı paneli açıldı", "emerald");
    };

    const duzenlemePaneliAc = async (kullanici) => {
        setIslemde(true);

        const { data, error } = await supabase
            .from("kullanicilar")
            .select("id,kullanici_adi,kullanici,sifre")
            .eq("id", kullanici.id)
            .single();

        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        setFormVerisi({
            id: data.id,
            kullanici_adi: data.kullanici_adi || "",
            kullanici: data.kullanici || "",
            sifre: data.sifre || "",
        });

        setPanelKullanici(kullanici);
        setPanelModu("duzenle");
        setPanelAcik(true);
        logEkle(`${kullanici.ad} düzenleniyor`, "cyan");
    };

    const engelPaneliAc = (u) => {
        setPanelKullanici(u);
        setPanelModu("engel");
        setPanelAcik(true);
    };

    const silPaneliAc = (u) => {
        setPanelKullanici(u);
        setPanelModu("sil");
        setPanelAcik(true);
    };

    const kullaniciKaydet = async () => {
        if (
            !formVerisi.kullanici_adi.trim() ||
            !formVerisi.kullanici.trim() ||
            !formVerisi.sifre.trim()
        ) return;

        setIslemde(true);

        if (panelModu === "ekle") {
            const { data, error } = await supabase
                .from("kullanicilar")
                .insert({
                    kullanici_adi: formVerisi.kullanici_adi.trim(),
                    kullanici: formVerisi.kullanici.trim(),
                    sifre: formVerisi.sifre,
                    durum: "aktif",
                })
                .select("id,kullanici_adi,kullanici,durum")
                .single();

            setIslemde(false);

            if (error) {
                setHata(error.message);
                return;
            }

            const yeni = satirDonustur(data, kullanicilar.length);
            setKullanicilar((prev) => [...prev, yeni]);
            setSeciliKullanici(yeni);
            paneliKapat();
            logEkle(`${yeni.ad} eklendi`, "emerald");
            return;
        }

        const { data, error } = await supabase
            .from("kullanicilar")
            .update({
                kullanici_adi: formVerisi.kullanici_adi.trim(),
                kullanici: formVerisi.kullanici.trim(),
                sifre: formVerisi.sifre,
            })
            .eq("id", formVerisi.id)
            .select("id,kullanici_adi,kullanici,durum")
            .single();

        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        const guncellendi = satirDonustur(data, 0);

        setKullanicilar((prev) =>
            prev.map((u, i) =>
                u.id === guncellendi.id
                    ? { ...guncellendi, renk: prev[i]?.renk, durum: prev[i]?.durum || "aktif" }
                    : u
            )
        );

        setSeciliKullanici((prev) =>
            prev?.id === guncellendi.id ? { ...prev, ...guncellendi } : prev
        );

        paneliKapat();
        logEkle(`${guncellendi.ad} güncellendi`, "cyan");
    };

    const kullaniciyiSilOnayla = async () => {
        if (!panelKullanici) return;

        setIslemde(true);

        await supabase
            .from("kullanici_yetkileri")
            .delete()
            .eq("kullanici_id", panelKullanici.id);

        const { error } = await supabase
            .from("kullanicilar")
            .delete()
            .eq("id", panelKullanici.id);

        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        setKullanicilar((prev) => prev.filter((u) => u.id !== panelKullanici.id));
        if (seciliKullanici?.id === panelKullanici.id) setSeciliKullanici(null);

        paneliKapat();
        logEkle(`${panelKullanici.ad} silindi`, "kirmizi");
    };

    const kullaniciyiEngelleOnayla = async () => {
        if (!panelKullanici) return;

        const yeniDurum = panelKullanici.durum === "pasif" ? "aktif" : "pasif";

        setIslemde(true);

        const { error } = await supabase
            .from("kullanicilar")
            .update({ durum: yeniDurum })
            .eq("id", panelKullanici.id);

        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        setKullanicilar((prev) =>
            prev.map((u) => u.id === panelKullanici.id ? { ...u, durum: yeniDurum } : u)
        );

        if (seciliKullanici?.id === panelKullanici.id) {
            setSeciliKullanici((prev) => prev ? { ...prev, durum: yeniDurum } : prev);
        }

        paneliKapat();
        logEkle(
            `${panelKullanici.ad} ${yeniDurum === "pasif" ? "engellendi" : "aktif edildi"}`,
            yeniDurum === "pasif" ? "kirmizi" : "emerald"
        );
    };

    const yetkiUpsert = async ({
        kullanici_id,
        ekran_id,
        ekran_ogesi_id = null,
        ekran_alani_id = null,
        aktif
    }) => {
        return supabase
            .from("kullanici_yetkileri")
            .upsert(
                {
                    kullanici_id,
                    ekran_id,
                    ekran_ogesi_id,
                    ekran_alani_id,
                    aktif,
                    updated_at: new Date().toISOString(),
                },
                {
                    onConflict: "kullanici_id,ekran_id,ekran_ogesi_id,ekran_alani_id",
                }
            );
    };

    const toggleEkranYetkisi = async (ekranKod, aktifMi) => {
        if (!seciliKullanici) return;

        const ekranId = ekranMap[ekranKod];
        if (!ekranId) {
            setHata("Ekran eşleşmesi bulunamadı.");
            return;
        }

        setIslemde(true);
        const { error } = await yetkiUpsert({
            kullanici_id: seciliKullanici.id,
            ekran_id: ekranId,
            aktif: aktifMi,
        });
        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        setYetkiler((prev) => ({ ...prev, [yetkiAnahtari(ekranKod)]: aktifMi }));
        logEkle(`${ekranKod} ekranı ${aktifMi ? "açıldı" : "kapatıldı"}`, aktifMi ? "emerald" : "kirmizi");
    };

    const toggleOgeYetkisi = async (ekranKod, ogeKod, aktifMi) => {
        if (!seciliKullanici) return;

        const ekranId = ekranMap[ekranKod];
        const oge = ogeMap[ogeKod];

        if (!ekranId || !oge?.id) {
            setHata("Öğe eşleşmesi bulunamadı.");
            return;
        }

        setIslemde(true);
        const { error } = await yetkiUpsert({
            kullanici_id: seciliKullanici.id,
            ekran_id: ekranId,
            ekran_ogesi_id: oge.id,
            aktif: aktifMi,
        });
        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        setYetkiler((prev) => ({
            ...prev,
            [yetkiAnahtari(ekranKod, ogeKod)]: aktifMi,
        }));

        logEkle(`${ogeKod} ${aktifMi ? "açıldı" : "kapatıldı"}`, aktifMi ? "emerald" : "kirmizi");
    };

    const toggleAlanYetkisi = async (ekranKod, ogeKod, alanKod, aktifMi) => {
        if (!seciliKullanici) return;

        const ekranId = ekranMap[ekranKod];
        const oge = ogeMap[ogeKod];
        const alan = alanMap[alanKod];

        if (!ekranId || !oge?.id || !alan?.id) {
            setHata("Alan eşleşmesi bulunamadı.");
            return;
        }

        setIslemde(true);
        const { error } = await yetkiUpsert({
            kullanici_id: seciliKullanici.id,
            ekran_id: ekranId,
            ekran_ogesi_id: oge.id,
            ekran_alani_id: alan.id,
            aktif: aktifMi,
        });
        setIslemde(false);

        if (error) {
            setHata(error.message);
            return;
        }

        setYetkiler((prev) => ({
            ...prev,
            [yetkiAnahtari(ekranKod, ogeKod, alanKod)]: aktifMi,
        }));

        logEkle(`${alanKod} ${aktifMi ? "açıldı" : "kapatıldı"}`, aktifMi ? "emerald" : "kirmizi");
    };

    const ekraninTumOgeleriniAyarla = async (ekran, aktifMi) => {
        for (const oge of ekran.ogeler) {
            await toggleOgeYetkisi(ekran.kod, oge.kod, aktifMi);
        }
    };

    const ogeninTumAlanlariniAyarla = async (ekranKod, oge, aktifMi) => {
        if (!oge.alanlar?.length) return;
        for (const alan of oge.alanlar) {
            await toggleAlanYetkisi(ekranKod, oge.kod, alan.kod, aktifMi);
        }
    };

    const istat = {
        toplam: kullanicilar.length,
        aktif: kullanicilar.filter((u) => u.durum === "aktif").length,
        pasif: kullanicilar.filter((u) => u.durum === "pasif").length,
        yetkiSayisi: Object.values(yetkiler).filter(Boolean).length,
    };

    return (
        <div>
            Buraya mevcut JSX ve STYLES kısmını aynen bırak.
        </div>
    );
}