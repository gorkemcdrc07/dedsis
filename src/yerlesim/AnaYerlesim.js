import { Outlet } from "react-router-dom";
import UstMenu from "../bilesenler/UstMenu";

export default function AnaYerlesim({ theme, toggleTheme }) {

    return (
        <div className="uygulama-kabugu">
            <UstMenu theme={theme} toggleTheme={toggleTheme} />

            <main className="sayfa-icerigi">
                <Outlet />
            </main>
        </div>
    );
}