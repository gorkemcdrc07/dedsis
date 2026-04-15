import React from "react";
import { fmt } from "./helpers";

export function MiniBar({ value, max, color }) {
    const pct = max > 0 ? Math.min(100, (Math.abs(value) / max) * 100) : 0;
    const c = color || (value >= 0 ? "#15803d" : "#b91c1c");

    return (
        <div className="bar-track">
            <div className="bar-fill" style={{ width: `${pct}%`, background: c }} />
        </div>
    );
}

export function PBadge({ value }) {
    return <span className={`b ${value >= 0 ? "b-g" : "b-r"}`}>{fmt(value, true)}</span>;
}