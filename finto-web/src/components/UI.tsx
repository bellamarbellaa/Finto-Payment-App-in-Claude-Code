import type { CSSProperties, ReactNode } from 'react';
import { tint } from '../lib/tints';

/* ------------------------------------------------------------- avatar */

export function Avatar({
  initials,
  tintKey,
  size = 42,
  radius
}: {
  initials: string;
  tintKey?: string;
  size?: number;
  radius?: number;
}) {
  const style = tint(tintKey);
  return (
    <div
      className="avatar"
      style={{
        ...style,
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size / 3),
        fontSize: size * 0.345
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------ sheet */

export function Sheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && (
          <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 800, letterSpacing: '-.03em' }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ states */

export function Loading({ rows = 4, height = 66 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty">
      <h3>That didn&rsquo;t load</h3>
      <p style={{ marginBottom: 16 }}>{message}</p>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ toggle */

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className="row"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1 }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, letterSpacing: '-.015em' }}>{label}</div>
        {hint && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{hint}</div>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span
        aria-hidden="true"
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          background: checked ? 'var(--lime)' : 'var(--hairline)',
          position: 'relative',
          flex: 'none',
          transition: 'background .16s'
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(11,12,11,.28)',
            transition: 'left .16s cubic-bezier(.22,1,.36,1)'
          }}
        />
      </span>
    </label>
  );
}

/* ------------------------------------------------------------- misc */

export function StatusPill({
  label,
  bg,
  fg
}: {
  label: string;
  bg: string;
  fg: string;
}) {
  return (
    <span className="pill" style={{ background: bg, color: fg }}>
      {label}
    </span>
  );
}

export function ScreenHead({
  title,
  right,
  style
}: {
  title: string;
  right?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="screen-head" style={style}>
      <h1 className="screen-title">{title}</h1>
      {right}
    </div>
  );
}
