import { useEffect, useRef, useState } from 'react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
}

/**
 * Custom dropdown (button + listbox) so both the closed control and every
 * option row get colour-change hover feedback — native <select> cannot do that.
 */
export default function Dropdown<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  width,
}: {
  value: T;
  options: DropdownOption<T>[];
  onChange: (v: T) => void;
  ariaLabel?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="dd" ref={ref} style={width ? { width } : undefined}>
      <button
        type="button"
        className={`dd-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="dd-btn__label">{current?.label ?? '—'}</span>
        <span className="dd-btn__arrow" aria-hidden="true" />
      </button>
      {open && (
        <ul className="dd-list" role="listbox" aria-label={ariaLabel}>
          {options.map((o) => (
            <li
              key={String(o.value)}
              role="option"
              aria-selected={o.value === value}
              className={`dd-option${o.value === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
