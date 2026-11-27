import { FormEvent, PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { toast } from '../util';

export default function LoginPage() {
  const { user, busy, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [typedTitle, setTypedTitle] = useState('');
  const [formHovered, setFormHovered] = useState(false);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const paintOverlay = useCallback(() => {
    const hero = heroRef.current;
    const canvas = overlayRef.current;
    if (!hero || !canvas) return;
    const bounds = hero.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(bounds.width * dpr);
    canvas.height = Math.round(bounds.height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(10, 14, 26, 0.55)';
    ctx.fillRect(0, 0, bounds.width, bounds.height);
    if (pointerRef.current) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(pointerRef.current.x, pointerRef.current.y, 110, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  useEffect(() => {
    const title = 'MyHanns';
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedTitle(title.slice(0, index));
      if (index >= title.length) window.clearInterval(timer);
    }, 130);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    const canvas = overlayRef.current;
    if (!hero || !canvas) return;
    paintOverlay();
    const observer = new ResizeObserver(paintOverlay);
    observer.observe(hero);
    return () => observer.disconnect();
  }, [paintOverlay]);

  const eraseOverlay = (event: PointerEvent<HTMLDivElement>) => {
    const hero = heroRef.current;
    if (!hero) return;
    const bounds = hero.getBoundingClientRect();
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
    pointerRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    paintOverlay();
  };

  const pointerLeave = () => {
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = window.setTimeout(() => {
      pointerRef.current = null;
      paintOverlay();
      leaveTimerRef.current = null;
    }, 1000);
  };

  if (user) return <Navigate to="/tickets" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      toast('Signed in.');
      navigate('/tickets', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  };

  return (
    <div className="login-wrap">
      <div className={`login-split${formHovered ? ' is-form-hovered' : ''}`}>
        {/* 70%: community photo with a translucent dark overlay */}
        <div className="login-hero" ref={heroRef} onPointerEnter={eraseOverlay} onPointerMove={eraseOverlay} onPointerLeave={pointerLeave}>
          <img src="images/hanns.jpg" alt="MyHanns community" aria-hidden="true" />
          <canvas ref={overlayRef} className="login-hero__overlay" aria-hidden="true" />
        </div>

        {/* 30%: the sign-in form */}
        <form className="login-card" onSubmit={onSubmit} onPointerEnter={() => setFormHovered(true)} onPointerLeave={() => setFormHovered(false)}>
          <div className="login-brand-block"><div className="login-brand"><img src="images/logo.png" alt="" /><span>{typedTitle}<i className="type-caret" /></span></div><p>Web Admin Panel</p></div>

          {error && <div className="err-box">{error}</div>}

          <label className="login-field"><i className="fa-regular fa-envelope" aria-hidden="true" /><span className="field icon-field">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              autoFocus
            />
          </span></label>

          <label className="login-field"><i className="fa-solid fa-lock" aria-hidden="true" /><span className="field icon-field pw-wrap">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              title={showPw ? 'Hide password' : 'Show password'}
            >
              {/* closed eye by default; the open eye appears only when showing */}
              <i className={`fa-solid ${showPw ? 'fa-eye' : 'fa-eye-slash'}`} aria-hidden="true" />
            </button>
          </span></label>

          <button className="btn login-btn" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
