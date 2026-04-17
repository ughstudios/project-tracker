"use client";

import { FormEvent, useMemo, useState } from "react";

const CALIBRATION_OPTIONS = [
  { id: "single-layer", label: "Single layer calibration" },
  { id: "double-layer", label: "Double layer calibration" },
  { id: "low-chip-brightness", label: "Low chip brightness calibration" },
  { id: "grayscale-infibit", label: "Grayscale refinement + infibit" },
] as const;

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "submitting"; message?: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function PublicCalibrationRequestForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  const canSubmit = useMemo(() => submitState.status !== "submitting", [submitState.status]);

  function toggleType(id: string) {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTypes.length === 0) {
      setSubmitState({
        status: "error",
        message: "Select at least one calibration option.",
      });
      return;
    }

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    selectedTypes.forEach((type) => formData.append("calibrationTypes", type));

    setSubmitState({ status: "submitting", message: "Submitting..." });
    const response = await fetch("/api/public/forms/calibration", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

    if (!response.ok) {
      setSubmitState({
        status: "error",
        message: payload.error ?? "Could not submit the form. Please try again.",
      });
      return;
    }

    formEl.reset();
    setSelectedTypes([]);
    setSubmitState({
      status: "success",
      message: payload.message ?? "Your request has been submitted.",
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Calibration Type</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {CALIBRATION_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-2 rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-700"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selectedTypes.includes(option.id)}
                onChange={() => toggleType(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Screen resolution</span>
          <input
            name="screenResolution"
            type="text"
            required
            placeholder="e.g. 1920 x 1080"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">How many controllers</span>
          <input
            name="controllerCount"
            type="number"
            min={1}
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </section>

      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Type of screen (spherical, curved, etc.)</span>
        <input
          name="screenType"
          type="text"
          required
          placeholder="e.g. Curved"
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Required Photos</h2>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Photo of the screen</span>
          <input
            name="screenPhoto"
            type="file"
            accept="image/*"
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">3 separate photos of the screen</span>
          <input
            name="screenPhotosExtra"
            type="file"
            accept="image/*"
            multiple
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium">Photos of work environment for doing the calibration</span>
          <input
            name="workEnvironmentPhotos"
            type="file"
            accept="image/*"
            multiple
            required
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitState.status === "submitting" ? "Submitting..." : "Submit Form"}
        </button>
        {submitState.status !== "idle" ? (
          <p
            className={[
              "text-sm",
              submitState.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "",
              submitState.status === "error" ? "text-red-600 dark:text-red-400" : "",
            ].join(" ")}
          >
            {submitState.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
