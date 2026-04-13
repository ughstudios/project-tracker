"use client";

/**
 * @param value `null` hidden. `0`–`100` determinate %. Negative values = indeterminate / busy.
 */
export function UploadProgressBar({
  value,
  label,
  className = "",
}: {
  value: number | null;
  label?: string;
  className?: string;
}) {
  if (value === null) return null;
  const indeterminate = value < 0;

  return (
    <div className={`space-y-1 ${className}`}>
      {label ? <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</p> : null}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : value}
        aria-busy={indeterminate ? "true" : undefined}
      >
        {indeterminate ? (
          <div
            className="h-full w-full animate-pulse bg-blue-600"
            aria-label="Uploading"
          />
        ) : (
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-150 ease-out"
            style={{ width: `${value}%` }}
          />
        )}
      </div>
      {!indeterminate ? <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{value}%</p> : null}
    </div>
  );
}
