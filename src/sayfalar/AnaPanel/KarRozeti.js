import { paraBicimlendir } from "./araclar";

export default function KarRozeti({ value }) {
    return (
        <span className={`b ${value >= 0 ? "b-g" : "b-r"}`}>
            {paraBicimlendir(value, true)}
        </span>
    );
}