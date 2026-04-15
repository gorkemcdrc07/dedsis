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
} from "lucide-react";
import "./UstMenu.css";

const menuOgeleri = [
    { yol: "/ana-panel", etiket: "Ana Panel", ikon: LayoutDashboard },
    { yol: "/muhasebe-karlilik", etiket: "Muhasebe ve Karlılık", ikon: BadgeDollarSign },
    { yol: "/insan-kaynaklari", etiket: "İnsan Kaynakları", ikon: Users },
    { yol: "/proje-operasyon", etiket: "Filo Araçları", ikon: FolderKanban },
    { yol: "/kullanici-yetkileri", etiket: "Kullanıcı ve Yetkileri", ikon: ShieldCheck },
];

export default function UstMenu({ theme, toggleTheme }) {

    const navigate = useNavigate();

    const cikisYap = () => {
        localStorage.removeItem("token");
        sessionStorage.clear();
        navigate("/login", { replace: true });
    };

    return (
        <header className="ust-menu">
            <div className="ust-menu__parlama" />

            <div className="ust-menu__ic">
                <div className="marka-alani">
                    <div className="marka-ikon">
                        <span>F</span>
                    </div>

                    <div className="marka-yazi">
                        <div className="marka-baslik">Filo Araçları</div>
                        <div className="marka-alt-yazi">
                            Araç ve Operasyon Yönetim Sistemi
                        </div>
                    </div>
                </div>

                <nav className="menu-linkleri">
                    {menuOgeleri.map((oge) => {
                        const Icon = oge.ikon;

                        return (
                            <NavLink
                                key={oge.yol}
                                to={oge.yol}
                                className={({ isActive }) =>
                                    `menu-link ${isActive ? "menu-link--aktif" : ""}`
                                }
                            >
                                <span className="menu-link__ikon">
                                    <Icon size={18} strokeWidth={2.2} />
                                </span>
                                <span className="menu-link__etiket">{oge.etiket}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="ust-menu__aksiyonlar">
                    <button className="tema-btn" type="button" onClick={toggleTheme}>
                        {theme === "dark" ? (
                            <>
                                <Sun size={16} strokeWidth={2.2} />
                                <span>Açık Tema</span>
                            </>
                        ) : (
                            <>
                                <Moon size={16} strokeWidth={2.2} />
                                <span>Koyu Tema</span>
                            </>
                        )}
                    </button>

                    <button className="cikis-btn" onClick={cikisYap} type="button">
                        <LogOut size={16} strokeWidth={2.2} />
                        <span>Çıkış</span>
                    </button>
                </div>
            </div>
        </header>
    );
}