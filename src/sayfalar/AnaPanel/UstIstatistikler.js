import { paraBicimlendir } from "./araclar";

export default function UstIstatistikler({ stats }) {
    return (
        <div className="stats-bar">
            <div className="stat-cell">
                <div className="stat-lbl">Toplam Alýþ</div>
                <div className="stat-val">{paraBicimlendir(stats.purchase, true)}</div>
            </div>

            <div className="stat-cell">
                <div className="stat-lbl">Toplam Satýþ</div>
                <div className="stat-val">{paraBicimlendir(stats.sales, true)}</div>
            </div>

            <div className="stat-cell">
                <div className={`stat-val ${stats.profit >= 0 ? "g" : "r"}`}>
                    {paraBicimlendir(stats.profit, true)}
                </div>
                <div className="stat-lbl">Net Kar</div>
            </div>

            <div className="stat-cell">
                <div className="stat-lbl">Proje / Plaka</div>
                <div className="stat-val">
                    {stats.projCount} / {stats.plates}
                </div>
            </div>
        </div>
    );
}