interface LoadingStateProps {
  rows?: number;
  compact?: boolean;
}

export function LoadingState({ rows = 4, compact = false }: LoadingStateProps) {
  return (
    <div className="pan-loading" role="status" aria-label="Loading content">
      {Array.from({ length: rows }).map((_, index) => (
        <div className={compact ? "pan-skeleton-row pan-skeleton-row-compact" : "pan-skeleton-row"} key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export default LoadingState;
