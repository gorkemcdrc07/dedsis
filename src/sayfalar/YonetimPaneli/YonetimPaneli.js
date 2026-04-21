import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import "./YonetimPaneli.css";

const PALETTE = ["mor", "yesil", "mavi", "turuncu"];

const avatarOlustur = (ad) => {
    if (!ad) return "KU";
    return ad
        .split(" ")
        .map((k) => k[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
};

const satirDonustur = (u, index = 0) => ({
    id: u.id,
    ad: u.kullanici_adi || "İsimsiz",
    email: u.kullanici || "-",
    rol: "Kullanıcı",
    durum: "aktif",
    giris: "Bilinmiyor",
    av: avatarOlustur(u.kullanici_adi),
    renk: PALETTE[index % PALETTE.length],
});

export default function YonetimPaneliSayfasi() {
    const [kullanicilar, setKullanicilar] = useState([]);
    const [arama, setArama] = useState("");
    const [seciliKullanici, setSeciliKullanici] = useState(null);

    const [ekranlar, setEkranlar] = useState([]);
    const [ekranOgeleri, setEkranOgeleri] = useState([]);
    const [ekranAlanlari, setEkranAlanlari] = useState([]);

    const [yetkiler, setYetkiler] = useState({});
    const [acikEkranlar, setAcikEkranlar] = useState({});

    const [yukleniyor, setYukleniyor] = useState(false);
    const [kaydediliyor, setKaydediliyor] = useState(false);
    const [hata, setHata] = useState("");
    const [bilgi, setBilgi] = useState("");

    const yetkiAnahtari = useCallback((ekranKod, ogeKod = null, alanKod = null) => {
        if (alanKod) return `${ekranKod}__${ogeKod}__${alanKod}`;
        if (ogeKod) return `${ekranKod}__${ogeKod}`;
        return ekranKod;
    }, []);

    const ekranOgeleriMap = useMemo(() => {
        const map = {};
        ekranlar.forEach((e) => {
            map[e.id] = ekranOgeleri.filter((o) => o.ekran_id === e.id);
        });
        return map;
    }, [ekranlar, ekranOgeleri]);

    const ogeAlanlariMap = useMemo(() => {
        const map = {};
        ekranOgeleri.forEach((o) => {
            map[o.id] = ekranAlanlari.filter((a) => a.ekran_ogesi_id === o.id);
        });
        return map;
    }, [ekranOgeleri, ekranAlanlari]);

    const toplamAktifYetki = useMemo(
        () => Object.values(yetkiler).filter(Boolean).length,
        [yetkiler]
    );

    const filtrelenmis = useMemo(() => {
        const m = arama.toLowerCase().trim();
        if (!m) return kullanicilar;

        return kullanicilar.filter(
            (u) =>
                String(u.ad || "").toLowerCase().includes(m) ||
                String(u.email || "").toLowerCase().includes(m)
        );
    }, [kullanicilar, arama]);

    const aktifKullaniciSayisi = useMemo(
        () =>
            kullanicilar.filter(
                (k) => String(k.durum || "").toLowerCase() === "aktif"
            ).length,
        [kullanicilar]
    );

    const seciliKullaniciYetkileriniGetir = useCallback(async (kullaniciId) => {
        if (!kullaniciId) {
            setYetkiler({});
            return;
        }

        setHata("");
        setBilgi("");

        const { data, error } = await supabase
            .from("kullanici_yetkileri")
            .select(`
                id,
                aktif,
                yetki_durumu,
                ekran_id,
                ekran_ogesi_id,
                ekran_alani_id,
                ekranlar:ekran_id(id,kod),
                ekran_ogeleri:ekran_ogesi_id(id,kod),
                ekran_alanlari:ekran_alani_id(id,kod)
            `)
            .eq("kullanici_id", kullaniciId)
            .eq("aktif", true)
            .eq("yetki_durumu", "izin_verildi");

        if (error) {
            console.error("kullanici_yetkileri sorgu hatasi:", error);
            setYetkiler({});
            setHata(error.message || "Kullanıcı yetkileri alınamadı.");
            return;
        }

        const yeni = {};
        (data || []).forEach((k) => {
            const ek = k.ekranlar?.kod;
            const og = k.ekran_ogeleri?.kod;
            const al = k.ekran_alanlari?.kod;

            if (!ek) return;
            yeni[yetkiAnahtari(ek, og, al)] = true;
        });

        setYetkiler(yeni);
    }, [yetkiAnahtari]);

    const referansTablolariHazirla = async () => {
        const { data: ekD, error: ekE } = await supabase
            .from("ekranlar")
            .select("id,kod,ad")
            .order("id", { ascending: true });

        if (ekE) {
            console.error("ekranlar sorgu hatasi:", ekE);
            return false;
        }
        setEkranlar(ekD || []);

        const { data: ogD, error: ogE } = await supabase
            .from("ekran_ogeleri")
            .select("id,kod,ad,ekran_id")
            .order("id", { ascending: true });

        if (ogE) {
            console.error("ekran_ogeleri sorgu hatasi:", ogE);
            return false;
        }
        setEkranOgeleri(ogD || []);

        const { data: alD, error: alE } = await supabase
            .from("ekran_alanlari")
            .select("id,kod,ad,ekran_ogesi_id")
            .order("id", { ascending: true });

        if (alE) {
            console.error("ekran_alanlari sorgu hatasi:", alE);
            return false;
        }
        setEkranAlanlari(alD || []);

        return true;
    };

    const kullanicilariGetir = async () => {
        const { data, error } = await supabase
            .from("kullanicilar")
            .select("id,kullanici_adi,kullanici")
            .order("id", { ascending: true });

        if (error) {
            console.error("kullanicilar sorgu hatasi:", error);
            setHata(error.message || "Kullanıcı listesi alınamadı.");
            setKullanicilar([]);
            setSeciliKullanici(null);
            return;
        }

        const list = (data || []).map((u, i) => satirDonustur(u, i));
        setKullanicilar(list);
        setSeciliKullanici((prev) =>
            prev ? list.find((k) => k.id === prev.id) || list[0] || null : list[0] || null
        );
    };

    useEffect(() => {
        (async () => {
            setYukleniyor(true);
            setHata("");

            const ok = await referansTablolariHazirla();
            if (!ok) {
                setHata("Referans tablolar yüklenemedi.");
                setYukleniyor(false);
                return;
            }

            await kullanicilariGetir();
            setYukleniyor(false);
        })();
    }, []);

    useEffect(() => {
        if (ekranlar.length > 0) {
            const varsayilan = {};
            ekranlar.forEach((e) => {
                varsayilan[e.id] = true;
            });
            setAcikEkranlar(varsayilan);
        }
    }, [ekranlar]);

    useEffect(() => {
        if (seciliKullanici?.id) {
            seciliKullaniciYetkileriniGetir(seciliKullanici.id);
        } else {
            setYetkiler({});
        }
    }, [seciliKullanici, seciliKullaniciYetkileriniGetir]);

    const ekranYetkisiVarMi = useCallback(
        (ekranKod) => !!yetkiler[yetkiAnahtari(ekranKod)],
        [yetkiler, yetkiAnahtari]
    );

    const ogeYetkisiVarMi = useCallback(
        (ekranKod, ogeKod) => !!yetkiler[yetkiAnahtari(ekranKod, ogeKod)],
        [yetkiler, yetkiAnahtari]
    );

    const alanYetkisiVarMi = useCallback(
        (ekranKod, ogeKod, alanKod) =>
            !!yetkiler[yetkiAnahtari(ekranKod, ogeKod, alanKod)],
        [yetkiler, yetkiAnahtari]
    );

    const ebeveynleriDengele = (state, ekranKod, ogeKod = null) => {
        const next = { ...state };

        const ekran = ekranlar.find((e) => e.kod === ekranKod);
        if (!ekran) return next;

        const ogeler = ekranOgeleriMap[ekran.id] || [];

        const ekranAktifMi =
            next[yetkiAnahtari(ekranKod)] ||
            ogeler.some((oge) => {
                const ogeKey = yetkiAnahtari(ekranKod, oge.kod);
                const alanlar = ogeAlanlariMap[oge.id] || [];
                const alanAktif = alanlar.some((alan) =>
                    next[yetkiAnahtari(ekranKod, oge.kod, alan.kod)]
                );
                return next[ogeKey] || alanAktif;
            });

        next[yetkiAnahtari(ekranKod)] = ekranAktifMi;

        if (ogeKod) {
            const oge = ogeler.find((o) => o.kod === ogeKod);
            if (oge) {
                const alanlar = ogeAlanlariMap[oge.id] || [];
                const ogeAktifMi =
                    next[yetkiAnahtari(ekranKod, ogeKod)] ||
                    alanlar.some((alan) =>
                        next[yetkiAnahtari(ekranKod, ogeKod, alan.kod)]
                    );

                next[yetkiAnahtari(ekranKod, ogeKod)] = ogeAktifMi;
            }
        }

        return next;
    };

    const ekranToggle = (ekran) => {
        const ekranKod = ekran.kod;
        const aktif = ekranYetkisiVarMi(ekranKod);

        setYetkiler((prev) => {
            const next = { ...prev };
            const yeniDeger = !aktif;

            next[yetkiAnahtari(ekranKod)] = yeniDeger;

            const ogeler = ekranOgeleriMap[ekran.id] || [];
            ogeler.forEach((oge) => {
                next[yetkiAnahtari(ekranKod, oge.kod)] = yeniDeger;

                const alanlar = ogeAlanlariMap[oge.id] || [];
                alanlar.forEach((alan) => {
                    next[yetkiAnahtari(ekranKod, oge.kod, alan.kod)] = yeniDeger;
                });
            });

            return next;
        });
    };

    const ogeToggle = (ekran, oge) => {
        const ekranKod = ekran.kod;
        const ogeKod = oge.kod;
        const aktif = ogeYetkisiVarMi(ekranKod, ogeKod);

        setYetkiler((prev) => {
            const next = { ...prev };
            const yeniDeger = !aktif;

            next[yetkiAnahtari(ekranKod)] = yeniDeger ? true : next[yetkiAnahtari(ekranKod)];
            next[yetkiAnahtari(ekranKod, ogeKod)] = yeniDeger;

            const alanlar = ogeAlanlariMap[oge.id] || [];
            alanlar.forEach((alan) => {
                next[yetkiAnahtari(ekranKod, ogeKod, alan.kod)] = yeniDeger;
            });

            return ebeveynleriDengele(next, ekranKod, ogeKod);
        });
    };

    const alanToggle = (ekran, oge, alan) => {
        const ekranKod = ekran.kod;
        const ogeKod = oge.kod;
        const alanKod = alan.kod;
        const aktif = alanYetkisiVarMi(ekranKod, ogeKod, alanKod);

        setYetkiler((prev) => {
            const next = { ...prev };
            const yeniDeger = !aktif;

            next[yetkiAnahtari(ekranKod, ogeKod, alanKod)] = yeniDeger;

            if (yeniDeger) {
                next[yetkiAnahtari(ekranKod)] = true;
                next[yetkiAnahtari(ekranKod, ogeKod)] = true;
            }

            return ebeveynleriDengele(next, ekranKod, ogeKod);
        });
    };

    const tumunuAcKapat = (durum) => {
        const next = {};

        ekranlar.forEach((ekran) => {
            next[yetkiAnahtari(ekran.kod)] = durum;

            const ogeler = ekranOgeleriMap[ekran.id] || [];
            ogeler.forEach((oge) => {
                next[yetkiAnahtari(ekran.kod, oge.kod)] = durum;

                const alanlar = ogeAlanlariMap[oge.id] || [];
                alanlar.forEach((alan) => {
                    next[yetkiAnahtari(ekran.kod, oge.kod, alan.kod)] = durum;
                });
            });
        });

        setYetkiler(next);
    };

    const kaydet = async () => {
        if (!seciliKullanici?.id) {
            setHata("Önce bir kullanıcı seç.");
            return;
        }

        setKaydediliyor(true);
        setHata("");
        setBilgi("");

        try {
            const aktifKayitlar = [];

            ekranlar.forEach((ekran) => {
                const ekranKey = yetkiAnahtari(ekran.kod);

                if (yetkiler[ekranKey]) {
                    aktifKayitlar.push({
                        kullanici_id: seciliKullanici.id,
                        ekran_id: ekran.id,
                        ekran_ogesi_id: null,
                        ekran_alani_id: null,
                        aktif: true,
                        yetki_durumu: "izin_verildi",
                    });
                }

                const ogeler = ekranOgeleriMap[ekran.id] || [];
                ogeler.forEach((oge) => {
                    const ogeKey = yetkiAnahtari(ekran.kod, oge.kod);

                    if (yetkiler[ogeKey]) {
                        aktifKayitlar.push({
                            kullanici_id: seciliKullanici.id,
                            ekran_id: ekran.id,
                            ekran_ogesi_id: oge.id,
                            ekran_alani_id: null,
                            aktif: true,
                            yetki_durumu: "izin_verildi",
                        });
                    }

                    const alanlar = ogeAlanlariMap[oge.id] || [];
                    alanlar.forEach((alan) => {
                        const alanKey = yetkiAnahtari(ekran.kod, oge.kod, alan.kod);

                        if (yetkiler[alanKey]) {
                            aktifKayitlar.push({
                                kullanici_id: seciliKullanici.id,
                                ekran_id: ekran.id,
                                ekran_ogesi_id: oge.id,
                                ekran_alani_id: alan.id,
                                aktif: true,
                                yetki_durumu: "izin_verildi",
                            });
                        }
                    });
                });
            });

            const { error: silError } = await supabase
                .from("kullanici_yetkileri")
                .delete()
                .eq("kullanici_id", seciliKullanici.id);

            if (silError) throw silError;

            if (aktifKayitlar.length > 0) {
                const { error: ekleError } = await supabase
                    .from("kullanici_yetkileri")
                    .insert(aktifKayitlar);

                if (ekleError) throw ekleError;
            }

            setBilgi(
                `${seciliKullanici.ad} için ${aktifKayitlar.length} aktif yetki kaydedildi.`
            );
            await seciliKullaniciYetkileriniGetir(seciliKullanici.id);
        } catch (err) {
            console.error("yetki kaydetme hatasi:", err);
            setHata(err?.message || "Yetkiler kaydedilemedi.");
        } finally {
            setKaydediliyor(false);
        }
    };

    const ekranIstatistikleri = useMemo(() => {
        return ekranlar.map((ekran) => {
            const ogeler = ekranOgeleriMap[ekran.id] || [];
            const alanlar = ogeler.flatMap((oge) => ogeAlanlariMap[oge.id] || []);

            const aktifOge = ogeler.filter((oge) =>
                ogeYetkisiVarMi(ekran.kod, oge.kod)
            ).length;

            const aktifAlan = alanlar.filter((alan) => {
                const oge = ekranOgeleri.find((o) => o.id === alan.ekran_ogesi_id);
                return oge
                    ? alanYetkisiVarMi(ekran.kod, oge.kod, alan.kod)
                    : false;
            }).length;

            return {
                ekranId: ekran.id,
                aktifMi: ekranYetkisiVarMi(ekran.kod),
                aktifOge,
                aktifAlan,
            };
        });
    }, [
        ekranlar,
        ekranOgeleriMap,
        ogeAlanlariMap,
        ekranOgeleri,
        ekranYetkisiVarMi,
        ogeYetkisiVarMi,
        alanYetkisiVarMi,
    ]);

    return (
        <div className="yp-sayfa">
            <div className="yp-header">
                <div>
                    <h1 className="yp-baslik">Yönetim Paneli</h1>
                    <p className="yp-alt">
                        Kullanıcı seç, ekran/öğe/alan bazlı yetkileri düzenle ve kaydet.
                    </p>
                </div>

                <div className="yp-header-aksiyonlar">
                    <button className="yp-btn" onClick={() => tumunuAcKapat(true)}>
                        Tüm Yetkileri Aç
                    </button>
                    <button className="yp-btn" onClick={() => tumunuAcKapat(false)}>
                        Tüm Yetkileri Kapat
                    </button>
                    <button
                        className="yp-btn yp-btn--primary"
                        onClick={kaydet}
                        disabled={!seciliKullanici || kaydediliyor}
                    >
                        {kaydediliyor ? "Kaydediliyor..." : "Kaydet"}
                    </button>
                </div>
            </div>

            {hata ? <div className="yp-hata-kutu">{hata}</div> : null}
            {bilgi ? (
                <div
                    className="yp-hata-kutu"
                    style={{
                        background: "rgba(20, 83, 45, 0.22)",
                        borderColor: "rgba(34, 197, 94, 0.28)",
                        color: "#bbf7d0",
                    }}
                >
                    {bilgi}
                </div>
            ) : null}

            <div className="yp-stats">
                <div className="yp-stat-kart">
                    <div className="yp-stat-etiket">Toplam Kullanıcı</div>
                    <div className="yp-stat-deger">{kullanicilar.length}</div>
                    <span className="yp-badge yp-badge--mavi">Liste</span>
                </div>

                <div className="yp-stat-kart">
                    <div className="yp-stat-etiket">Aktif Kullanıcı</div>
                    <div className="yp-stat-deger">{aktifKullaniciSayisi}</div>
                    <span className="yp-badge yp-badge--yesil">Durum</span>
                </div>

                <div className="yp-stat-kart">
                    <div className="yp-stat-etiket">Toplam Ekran</div>
                    <div className="yp-stat-deger">{ekranlar.length}</div>
                    <span className="yp-badge yp-badge--turuncu">Referans</span>
                </div>

                <div className="yp-stat-kart">
                    <div className="yp-stat-etiket">Aktif Yetki</div>
                    <div className="yp-stat-deger">{toplamAktifYetki}</div>
                    <span className="yp-badge yp-badge--yesil">Seçili Kullanıcı</span>
                </div>
            </div>

            <div className="yp-ana-yerlesim">
                <div className="yp-sol-panel">
                    <div className="yp-kart">
                        <div className="yp-kart-head">
                            <div>
                                <div className="yp-kart-baslik">Kullanıcılar</div>
                                <div className="yp-secili-bilgi">
                                    {filtrelenmis.length} kullanıcı listeleniyor
                                </div>
                            </div>
                        </div>

                        <div className="yp-toolbar">
                            <div className="yp-arama">
                                <span>⌕</span>
                                <input
                                    type="text"
                                    placeholder="Kullanıcı ara..."
                                    value={arama}
                                    onChange={(e) => setArama(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="yp-kullanici-liste">
                            {yukleniyor ? (
                                <div className="yp-bos-alan">Yükleniyor...</div>
                            ) : filtrelenmis.length === 0 ? (
                                <div className="yp-bos-alan">Kullanıcı bulunamadı.</div>
                            ) : (
                                filtrelenmis.map((u) => (
                                    <div
                                        key={u.id}
                                        className={`yp-kullanici-kart ${seciliKullanici?.id === u.id ? "secili" : ""}`}
                                        onClick={() => setSeciliKullanici(u)}
                                    >
                                        <div className={`yp-avatar yp-avatar--${u.renk}`}>
                                            {u.av}
                                        </div>

                                        <div className="yp-kullanici-kart-yazi">
                                            <div className="yp-kullanici-ad">{u.ad}</div>
                                            <div className="yp-kullanici-email">{u.email}</div>
                                        </div>

                                        <div className="yp-kullanici-kart-aksiyon">
                                            <span
                                                className={`yp-badge ${String(u.durum).toLowerCase() === "aktif"
                                                        ? "yp-badge--yesil"
                                                        : "yp-badge--kirmizi"
                                                    }`}
                                            >
                                                {u.durum}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="yp-sag-panel">
                    <div className="yp-kart">
                        <div className="yp-kart-head">
                            <div>
                                <div className="yp-kart-baslik">Yetki Matrisi</div>
                                <div className="yp-secili-bilgi">
                                    {seciliKullanici
                                        ? `${seciliKullanici.ad} • ${seciliKullanici.email}`
                                        : "Seçili kullanıcı yok"}
                                </div>
                            </div>

                            <div className="yp-header-aksiyonlar">
                                <button
                                    className="yp-btn yp-btn--sm"
                                    onClick={() => tumunuAcKapat(true)}
                                >
                                    Hepsini Aç
                                </button>
                                <button
                                    className="yp-btn yp-btn--sm"
                                    onClick={() => tumunuAcKapat(false)}
                                >
                                    Hepsini Kapat
                                </button>
                            </div>
                        </div>

                        <div className="yp-ekran-matris">
                            {ekranlar.length === 0 ? (
                                <div className="yp-bos-alan">Ekran tanımı bulunamadı.</div>
                            ) : (
                                ekranlar.map((ekran) => {
                                    const ogeler = ekranOgeleriMap[ekran.id] || [];
                                    const ekranStat =
                                        ekranIstatistikleri.find((s) => s.ekranId === ekran.id) || {};
                                    const acik = !!acikEkranlar[ekran.id];

                                    return (
                                        <div className="yp-ekran-blok" key={ekran.id}>
                                            <div className="yp-ekran-blok-ust">
                                                <button
                                                    className="yp-ekran-toggle"
                                                    onClick={() =>
                                                        setAcikEkranlar((prev) => ({
                                                            ...prev,
                                                            [ekran.id]: !prev[ekran.id],
                                                        }))
                                                    }
                                                    type="button"
                                                >
                                                    {acik ? "−" : "+"}
                                                </button>

                                                <div className="yp-ekran-ikon yp-ekran-ikon--mor">
                                                    🖥
                                                </div>

                                                <div className="yp-ekran-yazi">
                                                    <div className="yp-ekran-ad">{ekran.ad}</div>
                                                    <div className="yp-ekran-alt">
                                                        {ogeler.length} öğe • {ekranStat.aktifAlan || 0} aktif alan
                                                    </div>
                                                </div>

                                                <div className="yp-switch-wrap">
                                                    <span className="yp-switch-label">
                                                        {ekranYetkisiVarMi(ekran.kod) ? "Açık" : "Kapalı"}
                                                    </span>
                                                    <button
                                                        className={`yp-switch ${ekranYetkisiVarMi(ekran.kod) ? "aktif" : ""}`}
                                                        type="button"
                                                        onClick={() => ekranToggle(ekran)}
                                                    >
                                                        <span className="yp-switch-top" />
                                                    </button>
                                                </div>
                                            </div>

                                            {acik && (
                                                <div className="yp-ekran-icerik">
                                                    <div className="yp-ekran-icerik-ust">
                                                        <div className="yp-ekran-icerik-baslik">
                                                            Ekran öğeleri
                                                        </div>

                                                        <div className="yp-toplu-btn-grup">
                                                            <button
                                                                className="yp-mini-btn"
                                                                type="button"
                                                                onClick={() => {
                                                                    setYetkiler((prev) => {
                                                                        const next = { ...prev };
                                                                        next[yetkiAnahtari(ekran.kod)] = true;

                                                                        ogeler.forEach((oge) => {
                                                                            next[yetkiAnahtari(ekran.kod, oge.kod)] = true;
                                                                            (ogeAlanlariMap[oge.id] || []).forEach((alan) => {
                                                                                next[
                                                                                    yetkiAnahtari(
                                                                                        ekran.kod,
                                                                                        oge.kod,
                                                                                        alan.kod
                                                                                    )
                                                                                ] = true;
                                                                            });
                                                                        });

                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                Tümünü Aç
                                                            </button>

                                                            <button
                                                                className="yp-mini-btn"
                                                                type="button"
                                                                onClick={() => {
                                                                    setYetkiler((prev) => {
                                                                        const next = { ...prev };
                                                                        next[yetkiAnahtari(ekran.kod)] = false;

                                                                        ogeler.forEach((oge) => {
                                                                            next[yetkiAnahtari(ekran.kod, oge.kod)] = false;
                                                                            (ogeAlanlariMap[oge.id] || []).forEach((alan) => {
                                                                                next[
                                                                                    yetkiAnahtari(
                                                                                        ekran.kod,
                                                                                        oge.kod,
                                                                                        alan.kod
                                                                                    )
                                                                                ] = false;
                                                                            });
                                                                        });

                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                Tümünü Kapat
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="yp-oge-liste">
                                                        {ogeler.length === 0 ? (
                                                            <div className="yp-bos-alan">Bu ekranda öğe yok.</div>
                                                        ) : (
                                                            ogeler.map((oge) => {
                                                                const alanlar = ogeAlanlariMap[oge.id] || [];
                                                                const ogeAktif = ogeYetkisiVarMi(
                                                                    ekran.kod,
                                                                    oge.kod
                                                                );

                                                                return (
                                                                    <div className="yp-oge-blok" key={oge.id}>
                                                                        <div className="yp-oge-satir">
                                                                            <div className="yp-oge-sol">
                                                                                <span
                                                                                    className={`yp-oge-durum ${ogeAktif ? "aktif" : ""}`}
                                                                                >
                                                                                    ✓
                                                                                </span>
                                                                                <span className="yp-oge-ad">
                                                                                    {oge.ad}
                                                                                </span>
                                                                            </div>

                                                                            <div className="yp-oge-sag">
                                                                                <span className="yp-muted">
                                                                                    {alanlar.length} alan
                                                                                </span>
                                                                                <button
                                                                                    className={`yp-switch ${ogeAktif ? "aktif" : ""}`}
                                                                                    type="button"
                                                                                    onClick={() => ogeToggle(ekran, oge)}
                                                                                >
                                                                                    <span className="yp-switch-top" />
                                                                                </button>
                                                                            </div>
                                                                        </div>

                                                                        {alanlar.length > 0 && (
                                                                            <div className="yp-alan-liste">
                                                                                {alanlar.map((alan) => {
                                                                                    const alanAktif =
                                                                                        alanYetkisiVarMi(
                                                                                            ekran.kod,
                                                                                            oge.kod,
                                                                                            alan.kod
                                                                                        );

                                                                                    return (
                                                                                        <div
                                                                                            className="yp-alan-satir"
                                                                                            key={alan.id}
                                                                                        >
                                                                                            <div className="yp-alan-sol">
                                                                                                <span
                                                                                                    className={`yp-oge-durum ${alanAktif ? "aktif" : ""}`}
                                                                                                >
                                                                                                    ✓
                                                                                                </span>
                                                                                                <span className="yp-alan-ad">
                                                                                                    {alan.ad}
                                                                                                </span>
                                                                                            </div>

                                                                                            <button
                                                                                                className={`yp-switch ${alanAktif ? "aktif" : ""}`}
                                                                                                type="button"
                                                                                                onClick={() =>
                                                                                                    alanToggle(
                                                                                                        ekran,
                                                                                                        oge,
                                                                                                        alan
                                                                                                    )
                                                                                                }
                                                                                            >
                                                                                                <span className="yp-switch-top" />
                                                                                            </button>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}