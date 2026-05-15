import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    BadgeDollarSign,
    Users,
    FolderKanban,
    ShieldCheck,
    LogOut,
    Sun,
    Moon,
    Crown,
    Truck,
    Building2,
} from "lucide-react";
import "./UstMenu.css";

const tumMenuOgeleri = [
    { yol: "/ana-panel", etiket: "Ana Panel", ikon: LayoutDashboard },
    { yol: "/yonetim-paneli", etiket: "Yönetim", ikon: Crown },
    { yol: "/muhasebe-karlilik", etiket: "Muhasebe", ikon: BadgeDollarSign },
    { yol: "/insan-kaynaklari", etiket: "İnsan Kaynakları", ikon: Users },
    { yol: "/proje-operasyon", etiket: "Filo Araçları", ikon: FolderKanban },
    { yol: "/evidea", etiket: "Evidea", ikon: Truck },
    { yol: "/basbug", etiket: "Başbuğ", ikon: Building2 },
    { yol: "/kullanici-yetkileri", etiket: "Yetkiler", ikon: ShieldCheck },
];

export default function UstMenu({ theme, toggleTheme, setIsAuthenticated }) {
    const navigate = useNavigate();

    const kullanici = JSON.parse(localStorage.getItem("user") || "{}");

    const kullaniciAdi = (kullanici.kullanici_adi || "")
        .toLowerCase()
        .trim();

    let menuOgeleri = tumMenuOgeleri;

    if (kullaniciAdi.includes("evidea")) {
        menuOgeleri = tumMenuOgeleri.filter((oge) => oge.yol === "/evidea");
    }

    if (
        kullaniciAdi.includes("başbuğ") ||
        kullaniciAdi.includes("basbug") ||
        kullaniciAdi.includes("başbug")
    ) {
        menuOgeleri = tumMenuOgeleri.filter((oge) => oge.yol === "/basbug");
    }

    const cikisYap = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.clear();

        if (typeof setIsAuthenticated === "function") {
            setIsAuthenticated(false);
        }

        navigate("/login", { replace: true });
    };

    return (
        <header className="ust-menu">
            <div className="ust-menu__ic">
                <div className="marka-alani">
                    <div className="marka-ikon">F</div>

                    <div className="marka-yazi">
                        <div className="marka-baslik">Filo Araçları</div>
                        <div className="marka-alt-yazi">
                            Araç ve Operasyon Yönetim Sistemi
                        </div>
                    </div>
                </div>

                <div className="menu-ayrac" />

                <nav className="menu-linkleri">
                    {menuOgeleri.map((oge) => {
                        const Icon = oge.ikon;

                        return (
                            <NavLink
                                key={oge.yol}
                                to={oge.yol}
                                className={({ isActive }) =>
                                    `menu-link${isActive ? " menu-link--aktif" : ""}`
                                }
                            >
                                <span className="menu-link__ikon">
                                    <Icon size={15} strokeWidth={2.1} />
                                </span>
                                <span className="menu-link__etiket">{oge.etiket}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="menu-ayrac" />

                <div className="ust-menu__aksiyonlar">
                    <button className="tema-btn" type="button" onClick={toggleTheme}>
                        {theme === "dark" ? (
                            <>
                                <Sun size={14} strokeWidth={2.1} />
                                <span>Açık Tema</span>
                            </>
                        ) : (
                            <>
                                <Moon size={14} strokeWidth={2.1} />
                                <span>Koyu Tema</span>
                            </>
                        )}
                    </button>

                    <button className="cikis-btn" type="button" onClick={cikisYap}>
                        <LogOut size={14} strokeWidth={2.1} />
                        <span>Çıkış</span>
                    </button>
                </div>
            </div>
        </header>
    );
}