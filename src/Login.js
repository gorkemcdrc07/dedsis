import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

/* ─── PARTICLE SYSTEM ─── */
const ParticleCanvas = () => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        let animId;
        let W, H;

        const resize = () => {
            W = canvas.width = window.innerWidth;
            H = canvas.height = window.innerHeight;
        };

        resize();
        window.addEventListener("resize", resize);

        const count = 55;
        const dots = Array.from({ length: count }, () => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            r: Math.random() * 1.2 + 0.3,
            vx: (Math.random() - 0.5) * 0.25,
            vy: (Math.random() - 0.5) * 0.25,
            alpha: Math.random() * 0.35 + 0.05,
        }));

        const draw = () => {
            ctx.clearRect(0, 0, W, H);

            dots.forEach((d) => {
                d.x += d.vx;
                d.y += d.vy;

                if (d.x < 0) d.x = W;
                if (d.x > W) d.x = 0;
                if (d.y < 0) d.y = H;
                if (d.y > H) d.y = 0;

                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255,107,43,${d.alpha})`;
                ctx.fill();
            });

            for (let i = 0; i < count; i++) {
                for (let j = i + 1; j < count; j++) {
                    const dx = dots[i].x - dots[j].x;
                    const dy = dots[i].y - dots[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 120) {
                        ctx.beginPath();
                        ctx.moveTo(dots[i].x, dots[i].y);
                        ctx.lineTo(dots[j].x, dots[j].y);
                        ctx.strokeStyle = `rgba(255,107,43,${0.04 * (1 - dist / 120)})`;
                        ctx.lineWidth = 0.6;
                        ctx.stroke();
                    }
                }
            }

            animId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 0,
            }}
        />
    );
};

const IcoTruck = () => (
    <svg viewBox="0 0 24 24">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 4v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="1.5" />
        <circle cx="18.5" cy="18.5" r="1.5" />
        <path d="M1 16h14M16 12h6" />
    </svg>
);

const IcoUser = () => (
    <svg viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const IcoLock = () => (
    <svg viewBox="0 0 24 24">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
);

const IcoArrow = () => (
    <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transition: "transform 0.25s", flexShrink: 0 }}
    >
        <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
);

const IcoShield = () => (
    <svg viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
);

const IcoCheck = () => (
    <svg viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const Login = ({ setIsAuthenticated }) => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [status, setStatus] = useState("idle");
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();

        if (status === "loading" || status === "success") return;

        setStatus("loading");

        setTimeout(() => {
            if (username === "admin" && password === "1234") {
                localStorage.setItem("token", "giris-basarili");
                setIsAuthenticated(true);
                setStatus("success");

                setTimeout(() => {
                    navigate("/ana-panel", { replace: true });
                }, 1200);
            } else {
                setStatus("error");
                setTimeout(() => setStatus("idle"), 3000);
            }
        }, 1000);
    };

    return (
        <div className="ls">
            <ParticleCanvas />
            <div className="ls__ring ls__ring--1" />
            <div className="ls__ring ls__ring--2" />
            <div className="ls__ring ls__ring--3" />
            <div className="ls__blob ls__blob--1" />
            <div className="ls__blob ls__blob--2" />
            <div className="ls__scan" />

            <div className="ls__box">
                {status === "success" && (
                    <div className="ls__success">
                        <div className="ls__success-ring">
                            <IcoCheck />
                        </div>
                        <p className="ls__success-title">ERİŞİM ONAYLANDI</p>
                        <p className="ls__success-sub">Panele yönlendiriliyorsunuz</p>
                        <div className="ls__progress">
                            <div className="ls__progress-fill" />
                        </div>
                    </div>
                )}

                <div className="ls__logo">
                    <div className="ls__logo-emblem">
                        <IcoTruck />
                    </div>
                    <span className="ls__logo-name">DEDSİS</span>
                    <span className="ls__logo-sub">Gelir &amp; Gider Yönetim Sistemi</span>
                </div>

                <form onSubmit={handleSubmit} autoComplete="off" noValidate>
                    <div className="ls__fields">
                        <div className="ls__field">
                            <span className="ls__field-icon">
                                <IcoUser />
                            </span>
                            <input
                                className="ls__input"
                                type="text"
                                placeholder="Kullanıcı adı"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                autoComplete="username"
                                spellCheck={false}
                                required
                            />
                        </div>

                        <div className="ls__field">
                            <span className="ls__field-icon">
                                <IcoLock />
                            </span>
                            <input
                                className="ls__input"
                                type="password"
                                placeholder="Şifre"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        {status === "error" && (
                            <div className="ls__error">
                                <span className="ls__error-dot" />
                                <span className="ls__error-text">
                                    Kullanıcı adı veya şifre hatalı.
                                </span>
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        className="ls__btn"
                        disabled={status === "loading" || status === "success"}
                    >
                        {status === "loading" ? (
                            <span className="ls__spin" />
                        ) : (
                            <>
                                GİRİŞ YAP
                                <IcoArrow />
                            </>
                        )}
                    </button>
                </form>

                <p className="ls__note">
                    <IcoShield />
                    Uçtan uca şifreli güvenli bağlantı
                </p>
            </div>
        </div>
    );
};

export default Login;