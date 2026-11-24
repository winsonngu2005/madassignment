import { useEffect, useRef, useState } from 'react';

/**
 * Fullscreen photo viewer.
 * - zoom via wheel or +/- buttons; the lower bound is 100% = the picture's
 *   natural size (never shrunk below the original), upper bound 600%
 * - drag to pan while zoomed
 * - download button
 */
export default function PhotoViewer({
  src,
  downloadName = 'photo.jpg',
  onClose,
}: {
  src: string;
  downloadName?: string;
  onClose: () => void;
}) {
  const MIN = 1;
  const MAX = 6;

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clamp = (s: number) => Math.min(MAX, Math.max(MIN, Math.round(s * 100) / 100));
  const zoomIn = () => setScale((s) => clamp(s * 1.25));
  const zoomOut = () => setScale((s) => clamp(s / 1.25));
  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({ x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) });
  };
  const onPointerUp = () => {
    drag.current = null;
    setDragging(false);
  };

  return (
    <div className="viewer-back">
      <div className="viewer-bar">
        <button className="vbtn" onClick={zoomOut} disabled={scale <= MIN} title="Zoom out (min 100% = original size)">
          <i className="fa-solid fa-magnifying-glass-minus" aria-hidden="true" />
        </button>
        <span className="zoom-pct">{Math.round(scale * 100)}%</span>
        <button className="vbtn" onClick={zoomIn} disabled={scale >= MAX} title="Zoom in">
          <i className="fa-solid fa-magnifying-glass-plus" aria-hidden="true" />
        </button>
        <button className="vbtn" onClick={reset} title="Reset to original size">
          <i className="fa-solid fa-rotate-left" aria-hidden="true" />
        </button>
        <a className="vbtn" href={src} download={downloadName} title="Download photo">
          <i className="fa-solid fa-download" aria-hidden="true" />
        </a>
        <span className="spacer" />
        <span className="hint">wheel to zoom · drag to pan · min 100%</span>
        <button className="vbtn vbtn--close" onClick={onClose} title="Close (Esc)">
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        </button>
      </div>
      <div
        className={`viewer-canvas${dragging ? ' is-dragging' : ''}`}
        onWheel={(e) => {
          if (e.deltaY < 0) zoomIn();
          else zoomOut();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          src={src}
          alt="site photo full view"
          draggable={false}
          style={{
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}
