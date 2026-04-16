import { NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, BadgeDollarSign, Users,
    FolderKanban, ShieldCheck, LogOut, Sun, Moon, Crown,
} from "lucide-react";
import "./UstMenu.css";

const menuOgeleri = [
    { yol: "/ana-panel", etiket: "Ana Panel", ikon: LayoutDashboard },
    { yol: "/yonetim-paneli", etiket: "Yönetim", ikon: Crown },
    { yol: "/muhasebe-karlilik", etiket: "Muhasebe", ikon: BadgeDollarSign },
    { yol: "/insan-kaynaklari", etiket: "İnsan Kaynakları", ikon: Users },
    { yol: "/proje-operasyon", etiket: "Filo Araçları", ikon: FolderKanban },
    { yol: "/kullanici-yetkileri", etiket: "Yetkiler", ikon: ShieldCheck },
];

export default function UstMenu({ theme, toggleTheme, setIsAuthenticated }) {
    const navigate = useNavigate();

    const cikisYap = () => {
        localStorage.removeItem("token");
        sessionStorage.clear();
        if (typeof setIsAuthenticated === "function") setIsAuthenticated(false);
        navigate("/login", { replace: true });
    };

    return (
        <header className="ust-menu">
            <div className="ust-menu__ic">

                {/* Marka */}
                <div className="marka-alani">
                    <div className="marka-ikon">F</div>
                    <div className="marka-yazi">
                        <div className="marka-baslik">Filo Araçları</div>
                        <div className="marka-alt-yazi">Araç ve Operasyon Yönetim Sistemi</div>
                    </div>
                </div>

                <div className="menu-ayrac" />

                {/* Navigasyon */}
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

                {/* Aksiyonlar */}
                <div className="ust-menu__aksiyonlar">
                    <button className="tema-btn" type="button" onClick={toggleTheme}>
                        {theme === "dark" ? (
                            <><Sun size={14} strokeWidth={2.1} /><span>Açık Tema</span></>
                        ) : (
                            <><Moon size={14} strokeWidth={2.1} /><span>Koyu Tema</span></>
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