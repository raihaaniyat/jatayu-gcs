// ════════════════════════════════════════════════════════════════════════
//  JATAYU GCS — Shared UI Components (Rewritten)
//  Clean, properly-spaced, professional components
// ════════════════════════════════════════════════════════════════════════

import type { ActionStatus } from '@/types';

// ── Metric Card ─────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  subtext?: string;
  onClick?: () => void;
}

export function MetricCard({ label, value, unit, accent, subtext, onClick }: MetricCardProps) {
  return (
    <div
      className={`gcs-card gcs-metric ${onClick ? 'gcs-card-clickable' : ''}`}
      onClick={onClick}
      style={accent ? { borderColor: accent + '33' } : undefined}
    >
      <div className="gcs-metric-header">
        <span className="gcs-metric-label">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <span className="gcs-metric-value" style={{ color: accent || 'var(--gcs-text)' }}>
          {value}
        </span>
        {unit && <span className="gcs-metric-unit">{unit}</span>}
      </div>
      {subtext && <div className="gcs-metric-subtext">{subtext}</div>}
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────────
interface StatusBadgeProps {
  status: 'online' | 'offline' | 'warning' | 'danger' | ActionStatus;
  label?: string;
  pulse?: boolean;
}

const BADGE_MAP: Record<string, { bg: string; fg: string }> = {
  online:  { bg: 'var(--gcs-success-dim)', fg: 'var(--gcs-success)' },
  success: { bg: 'var(--gcs-success-dim)', fg: 'var(--gcs-success)' },
  offline: { bg: 'var(--gcs-danger-dim)',  fg: 'var(--gcs-danger)' },
  failure: { bg: 'var(--gcs-danger-dim)',  fg: 'var(--gcs-danger)' },
  danger:  { bg: 'var(--gcs-danger-dim)',  fg: 'var(--gcs-danger)' },
  warning: { bg: 'var(--gcs-warning-dim)', fg: 'var(--gcs-warning)' },
  pending: { bg: 'var(--gcs-warning-dim)', fg: 'var(--gcs-warning)' },
};

export function StatusBadge({ status, label, pulse }: StatusBadgeProps) {
  const c = BADGE_MAP[status] || BADGE_MAP.offline;
  return (
    <span className="gcs-badge" style={{ background: c.bg, color: c.fg }}>
      <span className={`gcs-badge-dot ${pulse ? 'gcs-dot-pulse' : ''}`} style={{ background: c.fg }} />
      {label || status.toUpperCase()}
    </span>
  );
}

// ── Section Header ──────────────────────────────────────────────────
export function SectionHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="gcs-section-header">
      <h3 className="gcs-section-title">{title}</h3>
      {actions}
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="gcs-empty">
      <div className="gcs-empty-title">{title}</div>
      {description && <div className="gcs-empty-desc">{description}</div>}
    </div>
  );
}

// ── Loading State ───────────────────────────────────────────────────
export function LoadingState({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="gcs-empty">
      <div
        style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid var(--gcs-border)', borderTopColor: 'var(--gcs-accent)',
          animation: 'pulse-glow 1s linear infinite',
          marginBottom: 12,
        }}
      />
      <span className="gcs-mono" style={{ fontSize: 12, color: 'var(--gcs-text3)' }}>{text}</span>
    </div>
  );
}

// ── Quick Action Button ─────────────────────────────────────────────
interface QuickActionProps {
  label: string;
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'warning';
  onClick?: () => void;
  disabled?: boolean;
}

export function QuickAction({ label, variant = 'ghost', onClick, disabled }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`gcs-btn gcs-btn-${variant}`}
    >
      {label}
    </button>
  );
}
