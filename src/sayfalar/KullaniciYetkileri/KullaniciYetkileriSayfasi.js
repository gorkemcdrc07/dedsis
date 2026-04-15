import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./kullaniciYetkileri.css";
import { supabase } from "../../lib/supabase";

// ─── helpers ────────────────────────────────────────────────────────────────

function totalPct(projects = []) {
    return projects.reduce(
        (s, p) => s + (Number.isNaN(Number(p.yuzde)) ? 0 : Number(p.yuzde)),
        0
    );
}

function pctStatus(total) {
    if (total === 100) return "ok";
    if (total > 100) return "over";
    return "under";
}

// ─── UserCard ────────────────────────────────────────────────────────────────

function initials(name = "") {
    return name
        .split(" ")
        .map((w) => w[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function UserCard({ user, selected, onClick, localPct }) {
    const merged = user.projeler.map((p) => ({
        ...p,
        yuzde:
            localPct[p.projeId] !== undefined ? localPct[p.projeId] : p.yuzde,
    }));
    const total = totalPct(merged);
    const status = pctStatus(total);
    const hasLocal = Object.keys(localPct).length > 0;

    return (
        <button
            className={`ky-card ${selected ? "ky-card--selected" : ""} ky-card--${status}`}
            onClick={onClick}
            type="button"
        >
            <div className="ky-card__top">
                <div className={`ky-avatar ky-avatar--${status}`}>
                    {initials(user.ad)}
                </div>
                <div className="ky-card__info">
                    <div className="ky-card__name">
                        {user.ad}
                        {hasLocal && (
                            <span
                                className="ky-dot"
                                title="Kaydedilmemiş değişiklik"
                            />
                        )}
                    </div>
                    <div className="ky-card__meta">
                        {user.projeler.length} proje
                    </div>
                </div>
                <div className={`ky-badge ky-badge--${status}`}>%{total}</div>
            </div>

            <div className="ky-card__bar-wrap">
                <div
                    className={`ky-card__bar ky-card__bar--${status}`}
                    style={{ width: `${Math.min(total, 100)}%` }}
                />
            </div>

            <div className="ky-card__chips">
                {merged.slice(0, 4).map((p) => (
                    <span key={p.projeId} className="ky-chip">
                        {p.proje} <b>%{p.yuzde}</b>
                    </span>
                ))}
                {merged.length > 4 && (
                    <span className="ky-chip ky-chip--more">
                        +{merged.length - 4}
                    </span>
                )}
            </div>
        </button>
    );
}

// ─── SliderRow ───────────────────────────────────────────────────────────────

function SliderRow({ project, value, onChange, onRemove }) {
    return (
        <div className="ky-slider-row">
            <div className="ky-slider-row__name">{project.proje}</div>
            <div className="ky-slider-row__controls">
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="ky-slider"
                />
                <div className="ky-slider-row__num">
                    <input
                        type="number"
                        min={0}
                        max={100}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="ky-num-input"
                    />
                    <span>%</span>
                </div>
                <button
                    type="button"
                    className="ky-remove-btn"
                    onClick={onRemove}
                    title="Projeyi kaldır"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}

// ─── EditPanel ───────────────────────────────────────────────────────────────

function EditPanel({
    user,
    allUsers,
    allProjects,
    localPct,
    onPctChange,
    onSave,
    onRemove,
    onAddNew,
    onAssign,
    onShare,
    isSaving,
}) {
    const [newName, setNewName] = useState("");
    const [assignId, setAssignId] = useState("");
    const [shareProjectId, setShareProjectId] = useState("");
    const [shareUserId, setShareUserId] = useState("");
    const [tab, setTab] = useState("edit");

    const merged = user.projeler.map((p) => ({
        ...p,
        yuzde:
            localPct[p.projeId] !== undefined ? localPct[p.projeId] : p.yuzde,
    }));
    const total = totalPct(merged);
    const status = pctStatus(total);
    const hasUnsaved = Object.keys(localPct).length > 0;

    const existingIds = user.projeler.map((p) => p.projeId);
    const assignable = allProjects.filter((p) => !existingIds.includes(p.id));
    const otherUsers = allUsers.filter((u) => u.id !== user.id);

    const statusMsg =
        status === "ok"
            ? "✓ Toplam %100 — dağılım tamamlandı"
            : status === "over"
                ? `⚠ Toplam %${total} — %${total - 100} fazla`
                : `⚠ Toplam %${total} — %${100 - total} eksik`;

    return (
        <div className="ky-panel">
            <div className="ky-panel__header">
                <div className={`ky-avatar ky-avatar--${status} ky-avatar--lg`}>
                    {initials(user.ad)}
                </div>
                <div>
                    <div className="ky-panel__name">{user.ad}</div>
                    <div className="ky-panel__id">ID: {user.id}</div>
                </div>
            </div>

            <div className={`ky-total ky-total--${status}`}>
                <div className="ky-total__bar-track">
                    <div
                        className={`ky-total__bar-fill ky-total__bar-fill--${status}`}
                        style={{ width: `${Math.min(total, 100)}%` }}
                    />
                </div>
                <div className="ky-total__msg">{statusMsg}</div>
            </div>

            <div className="ky-tabs">
                <button
                    className={`ky-tab ${tab === "edit" ? "ky-tab--active" : ""}`}
                    onClick={() => setTab("edit")}
                    type="button"
                >
                    Yüzde Düzenle
                </button>
                <button
                    className={`ky-tab ${tab === "manage" ? "ky-tab--active" : ""}`}
                    onClick={() => setTab("manage")}
                    type="button"
                >
                    Proje Yönet
                </button>
            </div>

            <div className="ky-panel__body">
                {tab === "edit" && (
                    <>
                        {merged.length === 0 ? (
                            <div className="ky-empty">
                                Henüz proje atanmamış. "Proje Yönet" sekmesinden
                                ekleyin.
                            </div>
                        ) : (
                            <div className="ky-slider-list">
                                {merged.map((p) => (
                                    <SliderRow
                                        key={p.projeId}
                                        project={p}
                                        value={Number(p.yuzde) || 0}
                                        onChange={(v) =>
                                            onPctChange(user.id, p.projeId, v)
                                        }
                                        onRemove={() =>
                                            onRemove(user.id, p.projeId)
                                        }
                                    />
                                ))}
                            </div>
                        )}

                        {merged.length > 0 && (
                            <button
                                type="button"
                                className="ky-auto-btn"
                                onClick={() => {
                                    const each = Math.floor(100 / merged.length);
                                    merged.forEach((p, i) => {
                                        const v =
                                            i === merged.length - 1
                                                ? 100 -
                                                each * (merged.length - 1)
                                                : each;
                                        onPctChange(user.id, p.projeId, v);
                                    });
                                }}
                            >
                                ⚡ Eşit Dağıt
                            </button>
                        )}

                        <button
                            type="button"
                            className={`ky-save-btn ${!hasUnsaved ? "ky-save-btn--done" : ""} ${isSaving ? "ky-save-btn--saving" : ""}`}
                            onClick={() => onSave(user.id)}
                            disabled={!hasUnsaved || isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <span className="ky-spin" /> Kaydediliyor...
                                </>
                            ) : hasUnsaved ? (
                                <>💾 Kaydet</>
                            ) : (
                                <>✓ Kaydedildi</>
                            )}
                        </button>
                    </>
                )}

                {tab === "manage" && (
                    <div className="ky-manage">
                        <div className="ky-manage__section">
                            <div className="ky-manage__label">
                                Yeni proje oluştur ve ata
                            </div>
                            <div className="ky-manage__row">
                                <input
                                    type="text"
                                    className="ky-field"
                                    placeholder="Proje adı girin..."
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && newName.trim()) {
                                            onAddNew(user.id, newName);
                                            setNewName("");
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    className="ky-action-btn"
                                    onClick={() => {
                                        onAddNew(user.id, newName);
                                        setNewName("");
                                    }}
                                    disabled={!newName.trim()}
                                >
                                    Oluştur
                                </button>
                            </div>
                        </div>

                        <div className="ky-manage__section">
                            <div className="ky-manage__label">
                                Mevcut projeyi ata
                            </div>
                            <div className="ky-manage__row">
                                <select
                                    className="ky-field"
                                    value={assignId}
                                    onChange={(e) => setAssignId(e.target.value)}
                                >
                                    <option value="">Proje seç...</option>
                                    {assignable.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.reel_proje_adi || p.proje_adi}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="ky-action-btn ky-action-btn--secondary"
                                    onClick={() => {
                                        onAssign(user.id, Number(assignId));
                                        setAssignId("");
                                    }}
                                    disabled={!assignId}
                                >
                                    Ata
                                </button>
                            </div>
                        </div>

                        <div className="ky-manage__section">
                            <div className="ky-manage__label">
                                Projeyi başka kullanıcıya da ver
                            </div>
                            <div className="ky-manage__col">
                                <select
                                    className="ky-field"
                                    value={shareProjectId}
                                    onChange={(e) =>
                                        setShareProjectId(e.target.value)
                                    }
                                >
                                    <option value="">Proje seç...</option>
                                    {user.projeler.map((p) => (
                                        <option
                                            key={p.projeId}
                                            value={p.projeId}
                                        >
                                            {p.proje}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="ky-field"
                                    value={shareUserId}
                                    onChange={(e) =>
                                        setShareUserId(e.target.value)
                                    }
                                >
                                    <option value="">Kullanıcı seç...</option>
                                    {otherUsers.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.ad}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    className="ky-action-btn ky-action-btn--success"
                                    onClick={() => {
                                        onShare(
                                            user.id,
                                            Number(shareUserId),
                                            Number(shareProjectId)
                                        );
                                        setShareProjectId("");
                                        setShareUserId("");
                                    }}
                                    disabled={!shareProjectId || !shareUserId}
                                >
                                    Paylaştır
                                </button>
                            </div>
                        </div>

                        <div className="ky-manage__section">
                            <div className="ky-manage__label">
                                Mevcut projeler
                            </div>
                            <div className="ky-proj-tags">
                                {user.projeler.map((p) => (
                                    <div
                                        key={p.projeId}
                                        className="ky-proj-tag"
                                    >
                                        <span>{p.proje}</span>
                                        <button
                                            type="button"
                                            className="ky-proj-tag__remove"
                                            onClick={() =>
                                                onRemove(user.id, p.projeId)
                                            }
                                            title="Kaldır"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                                {user.projeler.length === 0 && (
                                    <div className="ky-empty">Proje yok.</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KullaniciYetkileriSayfasi() {
    const [users, setUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [allProjects, setAllProjects] = useState([]);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [localPct, setLocalPct] = useState({});
    const [savingUsers, setSavingUsers] = useState(new Set());

    const loadData = async () => {
        setLoading(true);

        const [
            { data: usersData, error: uErr },
            { data: projectsData, error: pErr },
            { data: distData, error: dErr },
        ] = await Promise.all([
            supabase
                .from("kullanicilar")
                .select("id, kullanici_adi")
                .order("kullanici_adi"),

            supabase
                .from("projeler")
                .select("id, proje_adi, reel_proje_adi")
                .order("reel_proje_adi"),

            supabase.from("kullanici_proje_dagilim").select(`
                id,
                kullanici_id,
                proje_id,
                dagilim_yuzde,
                projeler:proje_id (
                    id,
                    proje_adi,
                    reel_proje_adi
                )
            `),
        ]);

        if (uErr || pErr || dErr) {
            alert("Veriler yüklenemedi.");
            setLoading(false);
            return;
        }

        setAllUsers(usersData || []);
        setAllProjects(projectsData || []);

        const grouped = (usersData || []).map((u) => ({
            id: u.id,
            ad: u.kullanici_adi,
            projeler: (distData || [])
                .filter((r) => r.kullanici_id === u.id)
                .map((r) => ({
                    projeId: r.proje_id,
                    proje:
                        r.projeler?.reel_proje_adi ||
                        r.projeler?.proje_adi ||
                        "",
                    yuzde: Number(r.dagilim_yuzde || 0),
                })),
        }));

        setUsers(grouped);
        setLocalPct({});
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filtered = useMemo(() => {
        const kw = search.trim().toLowerCase();
        if (!kw) return users;

        return users.filter(
            (u) =>
                u.ad.toLowerCase().includes(kw) ||
                u.projeler.some((p) => p.proje.toLowerCase().includes(kw))
        );
    }, [users, search]);

    const handlePctChange = useCallback((userId, projeId, value) => {
        const v = Math.max(
            0,
            Math.min(100, Number.isNaN(Number(value)) ? 0 : Number(value))
        );

        setLocalPct((prev) => ({
            ...prev,
            [userId]: { ...(prev[userId] || {}), [projeId]: v },
        }));
    }, []);

    const handleSave = async (userId) => {
        const changes = localPct[userId];
        if (!changes || !Object.keys(changes).length) return;

        setSavingUsers((s) => new Set([...s, userId]));

        const results = await Promise.all(
            Object.entries(changes).map(([projeId, yuzde]) =>
                supabase
                    .from("kullanici_proje_dagilim")
                    .update({ dagilim_yuzde: yuzde })
                    .eq("kullanici_id", userId)
                    .eq("proje_id", Number(projeId))
            )
        );

        if (results.some(({ error }) => error)) {
            alert("Bazı değerler kaydedilemedi.");
        } else {
            setLocalPct((prev) => {
                const n = { ...prev };
                delete n[userId];
                return n;
            });
            await loadData();
        }

        setSavingUsers((s) => {
            const n = new Set(s);
            n.delete(userId);
            return n;
        });
    };

    const handleAddNew = async (userId, name) => {
        const trimmed = (name || "").trim().toUpperCase();
        if (!trimmed) return;

        let projeId;
        const { data: ex } = await supabase
            .from("projeler")
            .select("id")
            .eq("proje_adi", trimmed)
            .maybeSingle();

        if (ex) {
            projeId = ex.id;
        } else {
            const { data: ins, error } = await supabase
                .from("projeler")
                .insert({ proje_adi: trimmed })
                .select("id")
                .single();

            if (error) {
                alert("Proje oluşturulamadı.");
                return;
            }
            projeId = ins.id;
        }

        const { error } = await supabase
            .from("kullanici_proje_dagilim")
            .insert({
                kullanici_id: userId,
                proje_id: projeId,
                dagilim_yuzde: 0,
            });

        if (error) {
            alert("Proje atanamadı.");
            return;
        }

        await loadData();
    };

    const handleAssign = async (userId, projeId) => {
        const { error } = await supabase
            .from("kullanici_proje_dagilim")
            .insert({
                kullanici_id: userId,
                proje_id: projeId,
                dagilim_yuzde: 0,
            });

        if (error) {
            alert("Proje atanamadı.");
            return;
        }

        await loadData();
    };

    const handleRemove = async (userId, projeId) => {
        const { error } = await supabase
            .from("kullanici_proje_dagilim")
            .delete()
            .eq("kullanici_id", userId)
            .eq("proje_id", projeId);

        if (error) {
            alert("Proje kaldırılamadı.");
            return;
        }

        setLocalPct((prev) => {
            if (!prev[userId]) return prev;

            const n = { ...prev, [userId]: { ...prev[userId] } };
            delete n[userId][projeId];
            if (!Object.keys(n[userId]).length) delete n[userId];
            return n;
        });

        await loadData();
    };

    const handleShare = async (fromId, toId, projeId) => {
        if (fromId === toId) return;

        const target = users.find((u) => u.id === toId);
        if (target?.projeler?.some((p) => p.projeId === projeId)) {
            alert("Bu proje zaten var.");
            return;
        }

        const { error } = await supabase
            .from("kullanici_proje_dagilim")
            .insert({
                kullanici_id: toId,
                proje_id: projeId,
                dagilim_yuzde: 0,
            });

        if (error) {
            alert("Paylaştırılamadı.");
            return;
        }

        await loadData();
    };

    const selectedUser = users.find((u) => u.id === selectedId) || null;
    const invalidCount = users.filter((u) => totalPct(u.projeler) !== 100).length;
    const unsavedCount = Object.keys(localPct).length;

    if (loading) {
        return (
            <div className="ky-page ky-page--loading">
                <div className="ky-loading-ring" />
                <span>Yükleniyor...</span>
            </div>
        );
    }

    return (
        <div className="ky-page">
            <div className="ky-topbar">
                <div className="ky-topbar__left">
                    <div className="ky-topbar__title">Kullanıcı Yetkileri</div>
                    <div className="ky-topbar__sub">
                        Proje dağılımı ve yetki yönetimi
                    </div>
                </div>
                <div className="ky-topbar__stats">
                    <div className="ky-stat-pill">
                        <span>Kullanıcı</span>
                        <b>{users.length}</b>
                    </div>
                    <div className="ky-stat-pill">
                        <span>Proje Havuzu</span>
                        <b>{allProjects.length}</b>
                    </div>
                    {invalidCount > 0 && (
                        <div className="ky-stat-pill ky-stat-pill--warn">
                            <span>Hatalı</span>
                            <b>{invalidCount}</b>
                        </div>
                    )}
                    {unsavedCount > 0 && (
                        <div className="ky-stat-pill ky-stat-pill--info">
                            <span>Kaydedilmemiş</span>
                            <b>{unsavedCount}</b>
                        </div>
                    )}
                </div>
            </div>

            <div className="ky-search-wrap">
                <span className="ky-search-icon">🔍</span>
                <input
                    type="text"
                    className="ky-search"
                    placeholder="Kullanıcı veya proje ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                    <button
                        type="button"
                        className="ky-search-clear"
                        onClick={() => setSearch("")}
                    >
                        ✕
                    </button>
                )}
            </div>

            <div className={`ky-body ${selectedUser ? "ky-body--split" : ""}`}>
                <div className="ky-grid">
                    {filtered.length === 0 && (
                        <div className="ky-empty ky-empty--full">
                            Kullanıcı bulunamadı.
                        </div>
                    )}
                    {filtered.map((user) => (
                        <UserCard
                            key={user.id}
                            user={user}
                            selected={selectedId === user.id}
                            onClick={() =>
                                setSelectedId(
                                    selectedId === user.id ? null : user.id
                                )
                            }
                            localPct={localPct[user.id] || {}}
                        />
                    ))}
                </div>

                {selectedUser && (
                    <div className="ky-panel-wrap">
                        <EditPanel
                            user={selectedUser}
                            allUsers={allUsers.map((u) => ({
                                id: u.id,
                                ad: u.kullanici_adi,
                            }))}
                            allProjects={allProjects}
                            localPct={localPct[selectedUser.id] || {}}
                            onPctChange={handlePctChange}
                            onSave={handleSave}
                            onRemove={handleRemove}
                            onAddNew={handleAddNew}
                            onAssign={handleAssign}
                            onShare={handleShare}
                            isSaving={savingUsers.has(selectedUser.id)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}