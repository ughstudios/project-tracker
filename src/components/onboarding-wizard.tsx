"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/context";

const STEP_KEYS = ["onboarding.s1", "onboarding.s2", "onboarding.s3", "onboarding.s4"] as const;

type Props = {
  onboardingCompleted: boolean;
};

export function OnboardingWizard({ onboardingCompleted }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [completed, setCompleted] = useState(onboardingCompleted);
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const total = STEP_KEYS.length;

  useEffect(() => {
    setCompleted(onboardingCompleted);
  }, [onboardingCompleted]);

  const persistAndClose = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/account/complete-onboarding", { method: "POST" });
      if (!res.ok) {
        setError(true);
        return;
      }
      setCompleted(true);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      savingRef.current = false;
      setPending(false);
    }
  }, [router]);

  const open = !completed;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void persistAndClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, persistAndClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open, step]);

  if (!open) return null;

  const prefix = STEP_KEYS[step];
  const title = t(`${prefix}.title`);
  const body = t(`${prefix}.body`);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-describedby="onboarding-wizard-body"
        aria-labelledby="onboarding-wizard-title"
        tabIndex={-1}
        className="panel-surface max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-xl p-6 shadow-lg outline-none ring-2 ring-zinc-900/10 dark:ring-white/10"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          {t("onboarding.stepOf", { current: String(step + 1), total: String(total) })}
        </p>
        <h2 id="onboarding-wizard-title" className="mt-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <p
          id="onboarding-wizard-body"
          className="mt-4 whitespace-pre-line text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
        >
          {body}
        </p>
        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{t("onboarding.completeFailed")}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-700">
          <button
            type="button"
            className="btn-secondary rounded-lg px-3 py-2 text-sm font-medium"
            disabled={pending}
            onClick={() => void persistAndClose()}
          >
            {pending ? t("common.saving") : t("onboarding.skip")}
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            {step > 0 ? (
              <button
                type="button"
                className="btn-secondary rounded-lg px-3 py-2 text-sm font-medium"
                disabled={pending}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                {t("common.previous")}
              </button>
            ) : null}
            {step < total - 1 ? (
              <button
                type="button"
                className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
                disabled={pending}
                onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              >
                {t("common.next")}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold"
                disabled={pending}
                onClick={() => void persistAndClose()}
              >
                {pending ? t("common.saving") : t("onboarding.done")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
