"use client";

export default function EmployeeNavAccessError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
      <h2 className="text-lg font-semibold">This page hit an error</h2>
      <p className="text-sm">
        If you just deployed, confirm{" "}
        <strong className="font-mono text-xs">AUTH_URL</strong> and{" "}
        <strong className="font-mono text-xs">NEXTAUTH_URL</strong> are set to your real site (e.g.{" "}
        <strong className="font-mono text-xs">https://tracker.colorlightcloud.com</strong>
        ), then clear site cookies and sign in again.
      </p>
      <pre className="max-h-48 overflow-auto rounded border border-red-200 bg-white p-2 text-xs whitespace-pre-wrap">
        {error.message}
        {error.digest ? `\n(digest: ${error.digest})` : ""}
      </pre>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-900 hover:bg-red-100"
      >
        Try again
      </button>
    </div>
  );
}
