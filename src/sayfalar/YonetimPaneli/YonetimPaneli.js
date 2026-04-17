import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
    Download, Plus, Search, ArrowUpDown,
    Pencil, Ban, Trash2, Save, X, ChevronDown, ChevronRight,
    Check, Shield, Users, Activity, Zap, Command, Layers,
    AlertTriangle, UserCheck, UserX,
    Fingerprint, Grid3x3, Eye, Lock, Unlock
} from "lucide-react";
import { supabase } from "../../lib/supabase";

/* ─── Sabit renkler ─── */
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
            .select("id,kod,ad");

        if (ekE) {
            setHata("ekranlar okunamadı.");
            return false;
        }

        const ekS = {};
        (ekD || []).forEach((e) => {
            ekS[e.kod] = e.id;
        });
        setEkranMap(ekS);
        setEkranlar(ekD || []);

        const { data: ogD, error: ogE } = await supabase
            .from("ekran_ogeleri")
            .select("id,kod,ad,ekran_id");

        if (ogE) {
            setHata("ekran_ogeleri okunamadı.");
            return false;
        }

        const ogS = {};
        (ogD || []).forEach((o) => {
            ogS[o.kod] = { id: o.id, ekran_id: o.ekran_id, ad: o.ad };
        });
        setOgeMap(ogS);
        setEkranOgeleri(ogD || []);

        const { data: alD, error: alE } = await supabase
            .from("ekran_alanlari")
            .select("id,kod,ad,ekran_ogesi_id");

        if (alE) {
            setHata("ekran_alanlari okunamadı.");
            return false;
        }

        const alS = {};
        (alD || []).forEach((a) => {
            alS[a.kod] = {
                id: a.id,
                ekran_ogesi_id: a.ekran_ogesi_id,
                ad: a.ad,
            };
        });
        setAlanMap(alS);
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
        setYukleniyor(true); setHata("");
        const { data, error } = await supabase.from("kullanicilar").select("id,kullanici_adi,kullanici,sifre").order("id", { ascending: true });
        if (error) { setHata(error.message); setYukleniyor(false); return; }
        const list = (data || []).map((u, i) => satirDonustur(u, i));
        setKullanicilar(list);
        setSeciliKullanici((prev) => prev ? list.find((k) => k.id === prev.id) || list[0] || null : list[0] || null);
        setYukleniyor(false);
    };

    useEffect(() => {
        (async () => { const ok = await referansTablolariHazirla(); if (ok) await kullanicilariGetir(); })();
    }, []);

    useEffect(() => {
        if (seciliKullanici?.id)
            seciliKullaniciYetkileriniGetir(seciliKullanici.id);
        else
            setYetkiler({});
    }, [seciliKullanici, seciliKullaniciYetkileriniGetir]);

    /* ─ keyboard shortcut ─ */
    useEffect(() => {
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setKomutPaleti((p) => !p); }
            if (e.key === "Escape") { setKomutPaleti(false); paneliKapat(); }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    /* ─ pagination ─ */
    const filtrelenmis = useMemo(() => kullanicilar.filter((u) => {
        const m = arama.toLowerCase();
        return u.ad.toLowerCase().includes(m) || u.email.toLowerCase().includes(m);
    }), [kullanicilar, arama]);

    const PER_PAGE = 8;
    const toplamSayfa = Math.max(1, Math.ceil(filtrelenmis.length / PER_PAGE));
    const gosterilen = filtrelenmis.slice((sayfa - 1) * PER_PAGE, sayfa * PER_PAGE);

    /* ─ auto-expand ─ */
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

    /* ─ panel openers ─ */
    const yeniKullaniciPaneliAc = () => { setPanelModu("ekle"); setPanelKullanici(null); setFormVerisi(BOS_FORM); setPanelAcik(true); logEkle("Yeni kullanıcı paneli açıldı", "emerald"); };
    const duzenlemePaneliAc = async (kullanici) => {
        setIslemde(true);
        const { data, error } = await supabase.from("kullanicilar").select("id,kullanici_adi,kullanici,sifre").eq("id", kullanici.id).single();
        setIslemde(false);
        if (error) { setHata(error.message); return; }
        setFormVerisi({ id: data.id, kullanici_adi: data.kullanici_adi || "", kullanici: data.kullanici || "", sifre: data.sifre || "" });
        setPanelKullanici(kullanici); setPanelModu("duzenle"); setPanelAcik(true);
        logEkle(`${kullanici.ad} düzenleniyor`, "cyan");
    };
    const engelPaneliAc = (u) => { setPanelKullanici(u); setPanelModu("engel"); setPanelAcik(true); };
    const silPaneliAc = (u) => { setPanelKullanici(u); setPanelModu("sil"); setPanelAcik(true); };

    /* ─ CRUD ─ */
    const kullaniciKaydet = async () => {
        if (!formVerisi.kullanici_adi.trim() || !formVerisi.kullanici.trim() || !formVerisi.sifre.trim()) return;
        setIslemde(true);
        if (panelModu === "ekle") {
            const { data, error } = await supabase.from("kullanicilar").insert({ kullanici_adi: formVerisi.kullanici_adi.trim(), kullanici: formVerisi.kullanici.trim(), sifre: formVerisi.sifre }).select("id,kullanici_adi,kullanici").single();
            setIslemde(false);
            if (error) { setHata(error.message); return; }
            const yeni = satirDonustur(data, kullanicilar.length);
            setKullanicilar((prev) => [...prev, yeni]); setSeciliKullanici(yeni); paneliKapat(); logEkle(`${yeni.ad} eklendi`, "emerald");
            return;
        }
        const { data, error } = await supabase.from("kullanicilar").update({ kullanici_adi: formVerisi.kullanici_adi.trim(), kullanici: formVerisi.kullanici.trim(), sifre: formVerisi.sifre }).eq("id", formVerisi.id).select("id,kullanici_adi,kullanici").single();
        setIslemde(false);
        if (error) { setHata(error.message); return; }
        const guncellendi = satirDonustur(data, 0);
        setKullanicilar((prev) => prev.map((u, i) => u.id === guncellendi.id ? { ...guncellendi, renk: prev[i]?.renk, durum: prev[i]?.durum || "aktif" } : u));
        setSeciliKullanici((prev) => prev?.id === guncellendi.id ? { ...prev, ...guncellendi } : prev);
        paneliKapat(); logEkle(`${guncellendi.ad} güncellendi`, "cyan");
    };

    const kullaniciyiSilOnayla = async () => {
        if (!panelKullanici) return;
        setIslemde(true);
        const { error } = await supabase.from("kullanicilar").delete().eq("id", panelKullanici.id);
        setIslemde(false);
        if (error) { setHata(error.message); return; }
        setKullanicilar((prev) => prev.filter((u) => u.id !== panelKullanici.id));
        if (seciliKullanici?.id === panelKullanici.id) setSeciliKullanici(null);
        paneliKapat(); logEkle(`${panelKullanici.ad} silindi`, "kirmizi");
    };

    const kullaniciyiEngelleOnayla = () => {
        if (!panelKullanici) return;
        const yeniDurum = panelKullanici.durum === "pasif" ? "aktif" : "pasif";
        setKullanicilar((prev) => prev.map((u) => u.id === panelKullanici.id ? { ...u, durum: yeniDurum } : u));
        if (seciliKullanici?.id === panelKullanici.id) setSeciliKullanici((prev) => prev ? { ...prev, durum: yeniDurum } : prev);
        paneliKapat(); logEkle(`${panelKullanici.ad} ${yeniDurum === "pasif" ? "engellendi" : "aktif edildi"}`, yeniDurum === "pasif" ? "kirmizi" : "emerald");
    };

    /* ─ yetki toggle ─ */
    const toggleEkranYetkisi = async (ekranKod, aktifMi) => {
        if (!seciliKullanici) return;
        const ekranId = ekranMap[ekranKod];
        if (!ekranId) { setHata("Ekran eşleşmesi bulunamadı."); return; }
        setIslemde(true);
        const { error } = await supabase.from("kullanici_yetkileri").upsert({ kullanici_id: seciliKullanici.id, ekran_id: ekranId, ekran_ogesi_id: null, ekran_alani_id: null, aktif: aktifMi, updated_at: new Date().toISOString() }, { onConflict: "kullanici_id,ekran_id,ekran_ogesi_id,ekran_alani_id" });
        setIslemde(false);
        if (error) { setHata(error.message); return; }
        setYetkiler((prev) => ({ ...prev, [yetkiAnahtari(ekranKod)]: aktifMi }));
        logEkle(`${ekranKod} ekranı ${aktifMi ? "açıldı" : "kapatıldı"}`, aktifMi ? "emerald" : "kirmizi");
    };

    const toggleOgeYetkisi = async (ekranKod, ogeKod, aktifMi) => {
        if (!seciliKullanici) return;
        const ekranId = ekranMap[ekranKod]; const oge = ogeMap[ogeKod];
        if (!ekranId || !oge?.id) { setHata("Öğe eşleşmesi bulunamadı."); return; }
        setIslemde(true);
        const { error } = await supabase.from("kullanici_yetkileri").upsert({ kullanici_id: seciliKullanici.id, ekran_id: ekranId, ekran_ogesi_id: oge.id, ekran_alani_id: null, aktif: aktifMi, updated_at: new Date().toISOString() }, { onConflict: "kullanici_id,ekran_id,ekran_ogesi_id,ekran_alani_id" });
        setIslemde(false);
        if (error) { setHata(error.message); return; }
        setYetkiler((prev) => ({ ...prev, [yetkiAnahtari(ekranKod, ogeKod)]: aktifMi }));
        logEkle(`${ogeKod} ${aktifMi ? "açıldı" : "kapatıldı"}`, aktifMi ? "emerald" : "kirmizi");
    };

    const toggleAlanYetkisi = async (ekranKod, ogeKod, alanKod, aktifMi) => {
        if (!seciliKullanici) return;
        const ekranId = ekranMap[ekranKod]; const oge = ogeMap[ogeKod]; const alan = alanMap[alanKod];
        if (!ekranId || !oge?.id || !alan?.id) { setHata("Alan eşleşmesi bulunamadı."); return; }
        setIslemde(true);
        const { error } = await supabase.from("kullanici_yetkileri").upsert({ kullanici_id: seciliKullanici.id, ekran_id: ekranId, ekran_ogesi_id: oge.id, ekran_alani_id: alan.id, aktif: aktifMi, updated_at: new Date().toISOString() }, { onConflict: "kullanici_id,ekran_id,ekran_ogesi_id,ekran_alani_id" });
        setIslemde(false);
        if (error) { setHata(error.message); return; }
        setYetkiler((prev) => ({ ...prev, [yetkiAnahtari(ekranKod, ogeKod, alanKod)]: aktifMi }));
        logEkle(`${alanKod} ${aktifMi ? "açıldı" : "kapatıldı"}`, aktifMi ? "emerald" : "kirmizi");
    };

    const ekraninTumOgeleriniAyarla = async (ekran, aktifMi) => { for (const oge of ekran.ogeler) await toggleOgeYetkisi(ekran.kod, oge.kod, aktifMi); };
    const ogeninTumAlanlariniAyarla = async (ekranKod, oge, aktifMi) => { if (!oge.alanlar?.length) return; for (const alan of oge.alanlar) await toggleAlanYetkisi(ekranKod, oge.kod, alan.kod, aktifMi); };

    /* ─ istatistik ─ */
    const istat = {
        toplam: kullanicilar.length,
        aktif: kullanicilar.filter((u) => u.durum === "aktif").length,
        pasif: kullanicilar.filter((u) => u.durum === "pasif").length,
        yetkiSayisi: Object.values(yetkiler).filter(Boolean).length,
    };

    /* ════════════════════════════════════════════════
       RENDER
    ════════════════════════════════════════════════ */
    return (
        <>
            <style>{STYLES}</style>

            {/* Komut Paleti */}
            {komutPaleti && (
                <div className="kp-overlay" onClick={() => setKomutPaleti(false)}>
                    <div className="kp-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="kp-header">
                            <Command size={15} />
                            <input ref={aramaRef} autoFocus className="kp-input" placeholder="Kullanıcı ara veya komut gir…" value={arama} onChange={(e) => { setArama(e.target.value); setSayfa(1); }} />
                            <kbd className="kp-esc">ESC</kbd>
                        </div>
                        <div className="kp-liste">
                            {gosterilen.slice(0, 6).map((u) => (
                                <button key={u.id} className={`kp-item${seciliKullanici?.id === u.id ? " aktif" : ""}`} onClick={() => { setSeciliKullanici(u); setKomutPaleti(false); }}>
                                    <span className="kp-av" style={{ background: COLOR_MAP[u.renk]?.bg, color: COLOR_MAP[u.renk]?.text, border: `1px solid ${COLOR_MAP[u.renk]?.border}` }}>{u.av}</span>
                                    <div>
                                        <div className="kp-ad">{u.ad}</div>
                                        <div className="kp-email">{u.email}</div>
                                    </div>
                                    <span className={`kp-badge ${u.durum}`}>{u.durum}</span>
                                </button>
                            ))}
                        </div>
                        <div className="kp-footer">
                            <span><kbd>↑↓</kbd> Gezin</span>
                            <span><kbd>↵</kbd> Seç</span>
                            <span><kbd>⌘K</kbd> Kapat</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="yp">
                {/* ─── HEADER ─── */}
                <header className="yp-header">
                    <div className="yp-header-sol">
                        <div className="yp-logo">
                            <Shield size={18} />
                        </div>
                        <div>
                            <h1 className="yp-baslik">YÖNETİM PANELİ</h1>
                            <p className="yp-alt">Kullanıcı & Yetki Matrisi</p>
                        </div>
                    </div>
                    <div className="yp-header-sag">
                        <button className="yp-cmd-btn" onClick={() => setKomutPaleti(true)}>
                            <Command size={13} />
                            <span>Hızlı Erişim</span>
                            <kbd>⌘K</kbd>
                        </button>
                        <button className="yp-btn yp-btn--ghost" onClick={() => logEkle("Dışa aktarıldı", "cyan")}>
                            <Download size={13} /> Dışa Aktar
                        </button>
                        <button className="yp-btn yp-btn--primary" onClick={yeniKullaniciPaneliAc}>
                            <Plus size={13} /> Yeni Kullanıcı
                        </button>
                    </div>
                </header>

                {/* ─── STAT KARTLARI ─── */}
                <div className="yp-stats">
                    {[
                        { label: "TOPLAM KULLANICI", value: istat.toplam, ikon: Users, renk: "cyan", alt: "Tüm hesaplar" },
                        { label: "AKTİF", value: istat.aktif, ikon: UserCheck, renk: "emerald", alt: "Erişim açık" },
                        { label: "PASİF", value: istat.pasif, ikon: UserX, renk: "kirmizi", alt: "Engelli hesap" },
                        { label: "AKTİF YETKİ", value: istat.yetkiSayisi, ikon: Fingerprint, renk: "amber", alt: "Seçili kullanıcı" },
                    ].map(({ label, value, ikon: Ikon, renk, alt }) => (
                        <div key={label} className="yp-stat" style={{ "--accent": COLOR_MAP[renk]?.text, "--accent-bg": COLOR_MAP[renk]?.bg, "--accent-border": COLOR_MAP[renk]?.border }}>
                            <div className="yp-stat-ikon"><Ikon size={16} /></div>
                            <div className="yp-stat-icerik">
                                <div className="yp-stat-label">{label}</div>
                                <div className="yp-stat-deger">{value}</div>
                                <div className="yp-stat-alt">{alt}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {hata && (
                    <div className="yp-hata">
                        <AlertTriangle size={14} /> {hata}
                        <button onClick={() => setHata("")}><X size={12} /></button>
                    </div>
                )}

                {/* ─── ANA YERLEŞIM ─── */}
                <div className="yp-ana">
                    {/* ── SOL: Kullanıcı Listesi ── */}
                    <aside className="yp-sidebar">
                        <div className="yp-sidebar-head">
                            <span className="yp-sidebar-baslik">
                                <Users size={13} /> Kullanıcılar
                            </span>
                            <span className="yp-sayac">{filtrelenmis.length}</span>
                        </div>
                        <div className="yp-arama-wrap">
                            <Search size={13} className="yp-arama-ikon" />
                            <input className="yp-arama-input" placeholder="Ara…" value={arama} onChange={(e) => { setArama(e.target.value); setSayfa(1); }} />
                            <button className="yp-sort-btn" onClick={() => setKullanicilar((p) => [...p].sort((a, b) => a.ad.localeCompare(b.ad, "tr")))}>
                                <ArrowUpDown size={12} />
                            </button>
                        </div>

                        {yukleniyor ? (
                            <div className="yp-loading">
                                {[...Array(4)].map((_, i) => (
                                    <div key={i} className="yp-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />
                                ))}
                            </div>
                        ) : (
                            <div className="yp-kullanici-liste">
                                {gosterilen.map((u) => {
                                    const c = COLOR_MAP[u.renk];
                                    const secili = seciliKullanici?.id === u.id;
                                    return (
                                        <div
                                            key={u.id}
                                            className={`yp-kart${secili ? " secili" : ""}`}
                                            style={secili ? { "--kart-accent": c?.text, "--kart-bg": c?.bg, "--kart-border": c?.border } : {}}
                                            onClick={() => setSeciliKullanici(u)}
                                        >
                                            <div className="yp-kart-av" style={{ background: c?.bg, color: c?.text, border: `1px solid ${c?.border}` }}>
                                                {u.av}
                                                <span className={`yp-durum-nokta ${u.durum}`} />
                                            </div>
                                            <div className="yp-kart-yazi">
                                                <div className="yp-kart-ad">{u.ad}</div>
                                                <div className="yp-kart-email">{u.email}</div>
                                            </div>
                                            <div className="yp-kart-aksiyonlar">
                                                <button className="yp-ikon-btn" title="Düzenle" onClick={(e) => { e.stopPropagation(); duzenlemePaneliAc(u); }}>
                                                    <Pencil size={11} />
                                                </button>
                                                <button className="yp-ikon-btn" title="Engelle" onClick={(e) => { e.stopPropagation(); engelPaneliAc(u); }}>
                                                    {u.durum === "pasif" ? <Unlock size={11} /> : <Lock size={11} />}
                                                </button>
                                                <button className="yp-ikon-btn danger" title="Sil" onClick={(e) => { e.stopPropagation(); silPaneliAc(u); }}>
                                                    <Trash2 size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="yp-pagination">
                            <button className="yp-pg-btn" onClick={() => setSayfa((p) => Math.max(1, p - 1))}>‹</button>
                            {Array.from({ length: toplamSayfa }, (_, i) => (
                                <button key={i} className={`yp-pg-btn${sayfa === i + 1 ? " aktif" : ""}`} onClick={() => setSayfa(i + 1)}>{i + 1}</button>
                            ))}
                            <button className="yp-pg-btn" onClick={() => setSayfa((p) => Math.min(toplamSayfa, p + 1))}>›</button>
                            <span className="yp-pg-info">{filtrelenmis.length} kayıt</span>
                        </div>
                    </aside>

                    {/* ── SAĞ: Yetki + Log ── */}
                    <main className="yp-main">
                        {/* Kullanıcı profil şeridi */}
                        {seciliKullanici && (
                            <div className="yp-profil-serit">
                                <div className="yp-profil-av" style={{ background: COLOR_MAP[seciliKullanici.renk]?.bg, color: COLOR_MAP[seciliKullanici.renk]?.text, border: `2px solid ${COLOR_MAP[seciliKullanici.renk]?.border}` }}>
                                    {seciliKullanici.av}
                                </div>
                                <div>
                                    <div className="yp-profil-ad">{seciliKullanici.ad}</div>
                                    <div className="yp-profil-email">{seciliKullanici.email}</div>
                                </div>
                                <span className={`yp-profil-badge ${seciliKullanici.durum}`}>{seciliKullanici.durum === "aktif" ? <><Zap size={11} /> Aktif</> : <><Ban size={11} /> Pasif</>}</span>
                                <div className="yp-profil-sekme-wrap">
                                    {["yetki", "profil"].map((s) => (
                                        <button key={s} className={`yp-sekme-btn${aktifSekme === s ? " aktif" : ""}`} onClick={() => setAktifSekme(s)}>
                                            {s === "yetki" ? <><Shield size={12} /> Yetki Matrisi</> : <><Eye size={12} /> Profil</>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Yetki Matrisi */}
                        <div className="yp-panel">
                            <div className="yp-panel-head">
                                <div className="yp-panel-head-sol">
                                    <Grid3x3 size={15} className="yp-panel-ikon" />
                                    <span className="yp-panel-baslik">Yetki Matrisi</span>
                                </div>
                                <span className="yp-panel-alt">
                                    {seciliKullanici ? `${seciliKullanici.ad} · ${istat.yetkiSayisi} aktif yetki` : "Kullanıcı seçin"}
                                </span>
                            </div>

                            {!seciliKullanici ? (
                                <div className="yp-bos">
                                    <Shield size={32} className="yp-bos-ikon" />
                                    <p>Yetki düzenlemek için soldan bir kullanıcı seçin.</p>
                                </div>
                            ) : (
                                <div className="yp-matris">
                                    {ekranYapisi.map((ekran) => {
                                        const c = COLOR_MAP[ekran.renk];
                                        const acikMi = acikEkranKodlari.includes(ekran.kod);
                                        const yetkiAcik = ekranYetkiDurumu(ekran.kod);
                                        return (
                                            <div key={ekran.kod} className={`yp-ekran-blok${acikMi ? " acik" : ""}`}>
                                                <div className="yp-ekran-ust">
                                                    <button className="yp-chevron-btn" onClick={() => toggleEkranAcikligi(ekran.kod)}>
                                                        {acikMi ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                    </button>
                                                    <div className="yp-ekran-bant" style={{ background: c?.bg, borderColor: c?.border }}>
                                                        <Layers size={13} style={{ color: c?.text }} />
                                                        <span className="yp-ekran-ad" style={{ color: c?.text }}>{ekran.ad}</span>
                                                    </div>
                                                    <div className="yp-ekran-sag">
                                                        <div className="yp-toplu-wrap">
                                                            {acikMi && (<>
                                                                <button className="yp-hizli-btn" onClick={() => ekraninTumOgeleriniAyarla(ekran, true)}>Tümünü Aç</button>
                                                                <button className="yp-hizli-btn" onClick={() => ekraninTumOgeleriniAyarla(ekran, false)}>Tümünü Kapat</button>
                                                            </>)}
                                                        </div>
                                                        <div className="yp-sw-grup">
                                                            <span className="yp-sw-etiket">Ekran</span>
                                                            <button className={`yp-sw${yetkiAcik ? " on" : ""}`} onClick={() => toggleEkranYetkisi(ekran.kod, !yetkiAcik)}>
                                                                <span className="yp-sw-knob" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {acikMi && (
                                                    <div className="yp-oge-wrap">
                                                        {(ekran.ogeler || []).map((oge) => {
                                                            const ogAcik = acikOgeKodlari.includes(oge.kod);
                                                            const ogYetki = ogeYetkiDurumu(ekran.kod, oge.kod);
                                                            return (
                                                                <div key={oge.kod} className="yp-oge-blok">
                                                                    <div className="yp-oge-satir">
                                                                        <button className="yp-og-toggle" disabled={!oge.alanlar?.length} onClick={() => oge.alanlar?.length && toggleOgeAcikligi(oge.kod)}>
                                                                            {oge.alanlar?.length ? (ogAcik ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span style={{ width: 12 }} />}
                                                                        </button>
                                                                        <span className={`yp-og-check${ogYetki ? " on" : ""}`}><Check size={10} strokeWidth={3} /></span>
                                                                        <span className="yp-og-ad">{oge.ad}</span>
                                                                        <div className="yp-og-sag">
                                                                            {oge.alanlar?.length > 0 && ogAcik && (<>
                                                                                <button className="yp-hizli-btn xs" onClick={() => ogeninTumAlanlariniAyarla(ekran.kod, oge, true)}>Alanları Aç</button>
                                                                                <button className="yp-hizli-btn xs" onClick={() => ogeninTumAlanlariniAyarla(ekran.kod, oge, false)}>Kapat</button>
                                                                            </>)}
                                                                            <button className={`yp-sw sm${ogYetki ? " on" : ""}`} onClick={() => toggleOgeYetkisi(ekran.kod, oge.kod, !ogYetki)}>
                                                                                <span className="yp-sw-knob" />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {oge.alanlar?.length > 0 && ogAcik && (
                                                                        <div className="yp-alan-wrap">
                                                                            {oge.alanlar.map((alan) => {
                                                                                const alYetki = alanYetkiDurumu(ekran.kod, oge.kod, alan.kod);
                                                                                return (
                                                                                    <div key={alan.kod} className="yp-alan-satir">
                                                                                        <span className={`yp-og-check sm${alYetki ? " on" : ""}`}><Check size={9} strokeWidth={3} /></span>
                                                                                        <span className="yp-alan-ad">{alan.ad}</span>
                                                                                        <button className={`yp-sw sm${alYetki ? " on" : ""}`} onClick={() => toggleAlanYetkisi(ekran.kod, oge.kod, alan.kod, !alYetki)}>
                                                                                            <span className="yp-sw-knob" />
                                                                                        </button>
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
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Aktivite Feed */}
                        <div className="yp-feed">
                            <div className="yp-feed-head">
                                <Activity size={13} className="yp-feed-ikon" />
                                <span>Aktivite</span>
                                <span className="yp-feed-sayac">{loglar.length}</span>
                            </div>
                            <div className="yp-feed-liste">
                                {loglar.map((l, i) => (
                                    <div key={i} className={`yp-feed-satir${i === 0 ? " yeni" : ""}`}>
                                        <span className="yp-feed-dot" style={{ background: COLOR_MAP[l.renk]?.dot }} />
                                        <span className="yp-feed-metin">{l.mesaj}</span>
                                        <span className="yp-feed-zaman">{l.zaman}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </main>
                </div>
            </div>

            {/* ── YAN PANEL ── */}
            {panelAcik && <div className="yp-overlay" onClick={paneliKapat} />}
            <div className={`yp-yan-panel${panelAcik ? " acik" : ""}`}>
                <div className="yp-yp-head">
                    <div className="yp-yp-baslik">
                        {panelModu === "ekle" && <><Plus size={15} /> Yeni Kullanıcı</>}
                        {panelModu === "duzenle" && <><Pencil size={15} /> Düzenle</>}
                        {panelModu === "engel" && <><Ban size={15} /> Durum Değiştir</>}
                        {panelModu === "sil" && <><Trash2 size={15} /> Kullanıcıyı Sil</>}
                    </div>
                    <button className="yp-ikon-btn" onClick={paneliKapat}><X size={14} /></button>
                </div>

                <div className="yp-yp-icerik">
                    {(panelModu === "ekle" || panelModu === "duzenle") && (
                        <div className="yp-form">
                            {[
                                { alan: "kullanici_adi", label: "Görünen Ad", placeholder: "Ahmet Yılmaz" },
                                { alan: "kullanici", label: "Kullanıcı Adı", placeholder: "ahmet" },
                                { alan: "sifre", label: "Şifre", placeholder: "••••••••", type: "password" },
                            ].map(({ alan, label, placeholder, type }) => (
                                <div key={alan} className="yp-form-grup">
                                    <label className="yp-form-label">{label}</label>
                                    <input className="yp-form-input" type={type || "text"} placeholder={placeholder} value={formVerisi[alan]} onChange={(e) => formDegistir(alan, e.target.value)} />
                                </div>
                            ))}
                            <div className="yp-form-aksiyonlar">
                                <button className="yp-btn yp-btn--primary" onClick={kullaniciKaydet} disabled={islemde}>
                                    <Save size={13} /> {panelModu === "ekle" ? "Kaydet" : "Güncelle"}
                                </button>
                                <button className="yp-btn yp-btn--ghost" onClick={paneliKapat} disabled={islemde}>Vazgeç</button>
                            </div>
                        </div>
                    )}

                    {panelModu === "engel" && panelKullanici && (
                        <div className="yp-onay">
                            <div className="yp-onay-kutup">
                                <div className="yp-onay-av" style={{ background: COLOR_MAP[panelKullanici.renk]?.bg, color: COLOR_MAP[panelKullanici.renk]?.text }}>{panelKullanici.av}</div>
                                <div className="yp-onay-ad">{panelKullanici.ad}</div>
                                <div className="yp-onay-aciklama">Bu kullanıcıyı <strong>{panelKullanici.durum === "pasif" ? "aktif etmek" : "engellemek"}</strong> üzeresin.</div>
                            </div>
                            <div className="yp-form-aksiyonlar">
                                <button className={`yp-btn ${panelKullanici.durum === "pasif" ? "yp-btn--primary" : "yp-btn--danger"}`} onClick={kullaniciyiEngelleOnayla}>
                                    {panelKullanici.durum === "pasif" ? <><Unlock size={13} /> Aktif Et</> : <><Lock size={13} /> Engelle</>}
                                </button>
                                <button className="yp-btn yp-btn--ghost" onClick={paneliKapat}>Vazgeç</button>
                            </div>
                        </div>
                    )}

                    {panelModu === "sil" && panelKullanici && (
                        <div className="yp-onay">
                            <div className="yp-onay-kutup danger">
                                <AlertTriangle size={28} className="yp-onay-uyari-ikon" />
                                <div className="yp-onay-ad">{panelKullanici.ad}</div>
                                <div className="yp-onay-aciklama">Bu kullanıcı <strong>kalıcı olarak</strong> silinecek. Bu işlem geri alınamaz.</div>
                            </div>
                            <div className="yp-form-aksiyonlar">
                                <button className="yp-btn yp-btn--danger" onClick={kullaniciyiSilOnayla} disabled={islemde}>
                                    <Trash2 size={13} /> Silmeyi Onayla
                                </button>
                                <button className="yp-btn yp-btn--ghost" onClick={paneliKapat}>Vazgeç</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

/* ════════════════════════════════════════════════
   STYLES — embedded for portability
════════════════════════════════════════════════ */
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #060c18;
  --bg1:      #0b1526;
  --bg2:      #101d33;
  --border:   rgba(255,255,255,0.06);
  --border2:  rgba(255,255,255,0.1);
  --text:     #e2e8f0;
  --text-dim: rgba(226,232,240,0.55);
  --amber:    #fbbf24;
  --cyan:     #22d3ee;
  --violet:   #a78bfa;
  --emerald:  #34d399;
  --red:      #f87171;
  --radius:   14px;
  --radius-sm:9px;
  font-family: 'Space Grotesk', sans-serif;
}

/* ── KOMUT PALETİ ── */
.kp-overlay { position: fixed; inset: 0; background: rgba(6,12,24,0.72); backdrop-filter: blur(6px); z-index: 200; display: flex; align-items: flex-start; justify-content: center; padding-top: 120px; }
.kp-modal { width: 520px; max-width: calc(100vw - 32px); background: var(--bg1); border: 1px solid var(--border2); border-radius: 18px; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.6); animation: slideDown 0.18s ease; }
@keyframes slideDown { from { opacity:0; transform: translateY(-12px); } to { opacity:1; transform: none; } }
.kp-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); color: var(--cyan); }
.kp-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text); font-size: 14px; font-family: inherit; }
.kp-input::placeholder { color: var(--text-dim); }
.kp-esc { background: var(--bg2); border: 1px solid var(--border); color: var(--text-dim); padding: 2px 7px; border-radius: 5px; font-size: 11px; font-family: 'JetBrains Mono', monospace; }
.kp-liste { max-height: 300px; overflow-y: auto; }
.kp-item { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: transparent; border: none; cursor: pointer; text-align: left; transition: background 0.1s; }
.kp-item:hover, .kp-item.aktif { background: rgba(34,211,238,0.06); }
.kp-av { width: 34px; height: 34px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
.kp-ad { font-size: 13px; font-weight: 600; color: var(--text); }
.kp-email { font-size: 11px; color: var(--text-dim); margin-top: 2px; }
.kp-badge { margin-left: auto; font-size: 10px; padding: 2px 8px; border-radius: 999px; font-weight: 600; }
.kp-badge.aktif { background: rgba(52,211,153,0.15); color: var(--emerald); }
.kp-badge.pasif { background: rgba(239,68,68,0.12); color: var(--red); }
.kp-footer { display: flex; gap: 16px; padding: 10px 16px; border-top: 1px solid var(--border); color: var(--text-dim); font-size: 11px; }
.kp-footer kbd { background: var(--bg2); border: 1px solid var(--border); padding: 1px 5px; border-radius: 4px; margin-right: 4px; font-family: 'JetBrains Mono', monospace; }

/* ── SAYFA ── */
.yp { min-height: 100vh; background: var(--bg); padding: 24px; display: flex; flex-direction: column; gap: 18px; color: var(--text); }

/* ── HEADER ── */
.yp-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.yp-header-sol { display: flex; align-items: center; gap: 14px; }
.yp-logo { width: 40px; height: 40px; border-radius: 12px; background: rgba(34,211,238,0.1); border: 1px solid rgba(34,211,238,0.25); display: flex; align-items: center; justify-content: center; color: var(--cyan); }
.yp-baslik { font-size: 17px; font-weight: 700; letter-spacing: 0.06em; color: #f8fafc; }
.yp-alt { font-size: 11px; color: var(--text-dim); margin-top: 2px; font-family: 'JetBrains Mono', monospace; }
.yp-header-sag { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.yp-cmd-btn { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border2); background: var(--bg1); color: var(--text-dim); cursor: pointer; font-size: 12px; font-family: inherit; transition: 0.15s; }
.yp-cmd-btn:hover { border-color: var(--cyan); color: var(--cyan); }
.yp-cmd-btn kbd { background: var(--bg2); border: 1px solid var(--border); padding: 1px 6px; border-radius: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; }
.yp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; border: 1px solid var(--border); cursor: pointer; transition: 0.15s; font-family: inherit; }
.yp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.yp-btn--ghost { background: var(--bg1); color: var(--text-dim); }
.yp-btn--ghost:hover { background: var(--bg2); color: var(--text); }
.yp-btn--primary { background: rgba(34,211,238,0.12); border-color: rgba(34,211,238,0.3); color: var(--cyan); }
.yp-btn--primary:hover { background: rgba(34,211,238,0.2); }
.yp-btn--danger { background: rgba(239,68,68,0.12); border-color: rgba(239,68,68,0.25); color: var(--red); }
.yp-btn--danger:hover { background: rgba(239,68,68,0.2); }

/* ── STAT ── */
.yp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.yp-stat { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; display: flex; gap: 14px; align-items: flex-start; position: relative; overflow: hidden; transition: border-color 0.2s; }
.yp-stat::before { content: ''; position: absolute; inset: 0; background: var(--accent-bg); opacity: 0; transition: opacity 0.2s; }
.yp-stat:hover::before { opacity: 1; }
.yp-stat:hover { border-color: var(--accent-border); }
.yp-stat-ikon { width: 36px; height: 36px; border-radius: 10px; background: var(--accent-bg); border: 1px solid var(--accent-border); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; position: relative; }
.yp-stat-icerik { position: relative; }
.yp-stat-label { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }
.yp-stat-deger { font-size: 26px; font-weight: 700; color: #f8fafc; line-height: 1.1; margin: 3px 0 2px; }
.yp-stat-alt { font-size: 11px; color: var(--accent); }

/* ── HATA ── */
.yp-hata { display: flex; align-items: center; gap: 10px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.22); color: #fca5a5; padding: 10px 14px; border-radius: var(--radius-sm); font-size: 13px; }
.yp-hata button { margin-left: auto; background: transparent; border: none; color: inherit; cursor: pointer; }

/* ── ANA YERLEŞIM ── */
.yp-ana { display: grid; grid-template-columns: 360px minmax(0,1fr); gap: 16px; align-items: start; }

/* ── SIDEBAR ── */
.yp-sidebar { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; position: sticky; top: 24px; }
.yp-sidebar-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
.yp-sidebar-baslik { display: flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 700; color: #f8fafc; }
.yp-sayac { background: rgba(34,211,238,0.12); color: var(--cyan); border: 1px solid rgba(34,211,238,0.2); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; }
.yp-arama-wrap { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-bottom: 1px solid var(--border); position: relative; }
.yp-arama-ikon { color: var(--text-dim); flex-shrink: 0; }
.yp-arama-input { flex: 1; background: transparent; border: none; outline: none; color: var(--text); font-size: 13px; font-family: inherit; }
.yp-arama-input::placeholder { color: var(--text-dim); }
.yp-sort-btn { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg2); color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.yp-sort-btn:hover { color: var(--text); }

/* ── SKELETON ── */
.yp-loading { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.yp-skeleton { height: 60px; border-radius: 10px; background: linear-gradient(90deg, var(--bg2) 25%, rgba(255,255,255,0.03) 50%, var(--bg2) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }

/* ── KULLANICI KART ── */
.yp-kullanici-liste { display: flex; flex-direction: column; }
.yp-kart { display: grid; grid-template-columns: 40px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; }
.yp-kart:hover { background: rgba(255,255,255,0.02); }
.yp-kart.secili { background: var(--kart-bg); border-left: 2px solid var(--kart-accent); }
.yp-kart-av { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; position: relative; flex-shrink: 0; }
.yp-durum-nokta { position: absolute; bottom: -2px; right: -2px; width: 9px; height: 9px; border-radius: 999px; border: 2px solid var(--bg1); }
.yp-durum-nokta.aktif { background: var(--emerald); }
.yp-durum-nokta.pasif { background: var(--red); }
.yp-kart-yazi { min-width: 0; }
.yp-kart-ad { font-size: 13px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yp-kart-email { font-size: 11px; color: var(--text-dim); margin-top: 2px; font-family: 'JetBrains Mono', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.yp-kart-aksiyonlar { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.yp-kart:hover .yp-kart-aksiyonlar { opacity: 1; }
.yp-ikon-btn { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg2); color: var(--text-dim); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.15s; }
.yp-ikon-btn:hover { background: rgba(34,211,238,0.1); color: var(--cyan); border-color: rgba(34,211,238,0.25); }
.yp-ikon-btn.danger:hover { background: rgba(239,68,68,0.12); color: var(--red); border-color: rgba(239,68,68,0.25); }

/* ── PAGINATION ── */
.yp-pagination { display: flex; align-items: center; gap: 4px; padding: 10px 16px; border-top: 1px solid var(--border); flex-wrap: wrap; }
.yp-pg-btn { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border); background: transparent; color: var(--text-dim); cursor: pointer; font-size: 12px; transition: 0.15s; }
.yp-pg-btn:hover { background: var(--bg2); color: var(--text); }
.yp-pg-btn.aktif { background: rgba(34,211,238,0.12); color: var(--cyan); border-color: rgba(34,211,238,0.3); }
.yp-pg-info { margin-left: auto; font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }

/* ── MAIN ── */
.yp-main { display: flex; flex-direction: column; gap: 14px; }

/* ── PROFİL ŞERİDİ ── */
.yp-profil-serit { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.yp-profil-av { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
.yp-profil-ad { font-size: 15px; font-weight: 700; color: #f8fafc; }
.yp-profil-email { font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
.yp-profil-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
.yp-profil-badge.aktif { background: rgba(52,211,153,0.12); color: var(--emerald); border: 1px solid rgba(52,211,153,0.2); }
.yp-profil-badge.pasif { background: rgba(239,68,68,0.12); color: var(--red); border: 1px solid rgba(239,68,68,0.2); }
.yp-profil-sekme-wrap { margin-left: auto; display: flex; gap: 6px; }
.yp-sekme-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: transparent; color: var(--text-dim); cursor: pointer; font-size: 12px; font-family: inherit; transition: 0.15s; }
.yp-sekme-btn:hover { color: var(--text); background: var(--bg2); }
.yp-sekme-btn.aktif { background: rgba(34,211,238,0.1); color: var(--cyan); border-color: rgba(34,211,238,0.25); }

/* ── PANEL (kart) ── */
.yp-panel { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.yp-panel-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.yp-panel-head-sol { display: flex; align-items: center; gap: 8px; }
.yp-panel-ikon { color: var(--amber); }
.yp-panel-baslik { font-size: 13px; font-weight: 700; color: #f8fafc; }
.yp-panel-alt { font-size: 11px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }
.yp-bos { padding: 48px 24px; text-align: center; color: var(--text-dim); display: flex; flex-direction: column; align-items: center; gap: 10px; }
.yp-bos-ikon { color: rgba(255,255,255,0.12); }

/* ── MATRİS ── */
.yp-matris { display: flex; flex-direction: column; }
.yp-ekran-blok { border-bottom: 1px solid var(--border); }
.yp-ekran-blok:last-child { border-bottom: none; }
.yp-ekran-ust { display: flex; align-items: center; gap: 10px; padding: 14px 18px; }
.yp-chevron-btn { width: 26px; height: 26px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg2); color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: 0.15s; }
.yp-chevron-btn:hover { color: var(--text); }
.yp-ekran-bant { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 8px; border: 1px solid; }
.yp-ekran-ad { font-size: 13px; font-weight: 700; }
.yp-ekran-sag { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.yp-toplu-wrap { display: flex; gap: 6px; }
.yp-hizli-btn { padding: 4px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg2); color: var(--text-dim); cursor: pointer; font-size: 11px; font-family: inherit; transition: 0.15s; }
.yp-hizli-btn:hover { color: var(--text); background: rgba(255,255,255,0.06); }
.yp-hizli-btn.xs { font-size: 10px; padding: 3px 8px; }
.yp-sw-grup { display: flex; align-items: center; gap: 7px; }
.yp-sw-etiket { font-size: 11px; color: var(--text-dim); }

/* ── SWITCH ── */
.yp-sw { position: relative; width: 44px; height: 24px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); cursor: pointer; transition: 0.2s; flex-shrink: 0; }
.yp-sw.sm { width: 36px; height: 20px; }
.yp-sw.on { background: rgba(52,211,153,0.18); border-color: rgba(52,211,153,0.3); }
.yp-sw-knob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 999px; background: rgba(255,255,255,0.6); transition: 0.2s; }
.yp-sw.sm .yp-sw-knob { width: 12px; height: 12px; }
.yp-sw.on .yp-sw-knob { transform: translateX(20px); background: var(--emerald); }
.yp-sw.sm.on .yp-sw-knob { transform: translateX(16px); }

/* ── OGE ── */
.yp-oge-wrap { padding: 0 18px 14px 18px; display: flex; flex-direction: column; gap: 6px; }
.yp-oge-blok { display: flex; flex-direction: column; gap: 6px; }
.yp-oge-satir { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; background: rgba(255,255,255,0.025); border: 1px solid var(--border); }
.yp-og-toggle { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text-dim); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
.yp-og-toggle:disabled { opacity: 0.35; cursor: default; }
.yp-og-check { width: 18px; height: 18px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; color: transparent; flex-shrink: 0; transition: 0.15s; }
.yp-og-check.on { background: rgba(52,211,153,0.15); border-color: rgba(52,211,153,0.3); color: var(--emerald); }
.yp-og-check.sm { width: 15px; height: 15px; }
.yp-og-ad { font-size: 12px; color: var(--text); font-weight: 500; }
.yp-og-sag { margin-left: auto; display: flex; align-items: center; gap: 6px; }

/* ── ALAN ── */
.yp-alan-wrap { padding-left: 30px; display: flex; flex-direction: column; gap: 5px; }
.yp-alan-satir { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 8px; background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); }
.yp-alan-ad { font-size: 11px; color: var(--text-dim); flex: 1; }

/* ── FEED ── */
.yp-feed { background: var(--bg1); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.yp-feed-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 700; color: #f8fafc; }
.yp-feed-ikon { color: var(--violet); }
.yp-feed-sayac { margin-left: auto; background: rgba(167,139,250,0.12); color: var(--violet); border: 1px solid rgba(167,139,250,0.2); padding: 1px 7px; border-radius: 999px; font-size: 10px; font-family: 'JetBrains Mono', monospace; }
.yp-feed-liste { display: flex; flex-direction: column; }
.yp-feed-satir { display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-bottom: 1px solid var(--border); transition: background 0.2s; }
.yp-feed-satir:last-child { border-bottom: none; }
.yp-feed-satir.yeni { animation: feedIn 0.3s ease; background: rgba(34,211,238,0.03); }
@keyframes feedIn { from { opacity:0; transform: translateX(-6px); } to { opacity:1; transform: none; } }
.yp-feed-dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }
.yp-feed-metin { font-size: 12px; color: var(--text); flex: 1; }
.yp-feed-zaman { font-size: 10px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }

/* ── YAN PANEL ── */
.yp-overlay { position: fixed; inset: 0; background: rgba(6,12,24,0.6); backdrop-filter: blur(4px); z-index: 50; }
.yp-yan-panel { position: fixed; top: 0; right: -440px; width: 420px; max-width: 100vw; height: 100vh; background: var(--bg1); border-left: 1px solid var(--border2); box-shadow: -20px 0 60px rgba(0,0,0,0.4); z-index: 60; transition: right 0.28s cubic-bezier(0.4,0,0.2,1); display: flex; flex-direction: column; }
.yp-yan-panel.acik { right: 0; }
.yp-yp-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.yp-yp-baslik { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #f8fafc; }
.yp-yp-icerik { padding: 20px; overflow-y: auto; flex: 1; }
.yp-form { display: flex; flex-direction: column; gap: 16px; }
.yp-form-grup { display: flex; flex-direction: column; gap: 6px; }
.yp-form-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }
.yp-form-input { background: var(--bg2); border: 1px solid var(--border2); color: var(--text); border-radius: var(--radius-sm); padding: 10px 13px; font-size: 13px; font-family: inherit; outline: none; width: 100%; transition: border-color 0.15s, box-shadow 0.15s; }
.yp-form-input::placeholder { color: var(--text-dim); }
.yp-form-input:focus { border-color: rgba(34,211,238,0.5); box-shadow: 0 0 0 3px rgba(34,211,238,0.08); }
.yp-form-aksiyonlar { display: flex; gap: 8px; margin-top: 4px; }
.yp-onay { display: flex; flex-direction: column; gap: 20px; }
.yp-onay-kutup { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.yp-onay-kutup.danger { background: rgba(127,29,29,0.18); border-color: rgba(239,68,68,0.22); }
.yp-onay-av { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 700; }
.yp-onay-uyari-ikon { color: var(--red); }
.yp-onay-ad { font-size: 16px; font-weight: 700; color: #f8fafc; }
.yp-onay-aciklama { font-size: 13px; color: var(--text-dim); line-height: 1.6; }

/* ── RESPONSIVE ── */
@media (max-width: 1100px) {
  .yp-ana { grid-template-columns: 1fr; }
  .yp-stats { grid-template-columns: repeat(2,1fr); }
  .yp-sidebar { position: static; }
}
@media (max-width: 640px) {
  .yp { padding: 14px; }
  .yp-stats { grid-template-columns: 1fr 1fr; }
  .yp-yan-panel { width: 100%; }
  .yp-profil-serit { flex-wrap: wrap; }
  .yp-profil-sekme-wrap { margin-left: 0; }
}
`;