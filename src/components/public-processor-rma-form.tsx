"use client";

import { listProcessorModelsForProjects } from "@/lib/product-catalog";
import { FormEvent, useMemo, useState } from "react";

const PROCESSOR_MODELS = listProcessorModelsForProjects();

const FILE_INPUT_CLASS =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:transition-colors hover:file:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-300";

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "submitting"; message?: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function PublicProcessorRmaForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [processorModel, setProcessorModel] = useState("");
  const [firmware, setFirmware] = useState("");

  const sortedModels = useMemo(() => [...PROCESSOR_MODELS].sort((a, b) => a.localeCompare(b)), []);

  const canSubmit = submitState.status !== "submitting";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!processorModel.trim()) {
      setSubmitState({ status: "error", message: "Select the processor model you are returning." });
      return;
    }
    if (!firmware.trim()) {
      setSubmitState({ status: "error", message: "Enter the firmware version on the unit." });
      return;
    }

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    formData.set("processorModel", processorModel.trim());
    formData.set("firmware", firmware.trim());

    setSubmitState({ status: "submitting", message: "Submitting..." });
    const response = await fetch("/api/public/forms/processor-rma", {
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
    setProcessorModel("");
    setFirmware("");
    setSubmitState({
      status: "success",
      message: payload.message ?? "Your RMA request has been submitted.",
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
        <p className="font-semibold">One form per processor</p>
        <p className="mt-1 text-sky-900/90 dark:text-sky-200/90">
          If you are returning multiple processors, complete and submit this form separately for each unit so we can
          match purchase details and issue descriptions to each product.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Contact</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            We use this for RMA updates and return shipping where applicable.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Contact name</span>
            <input
              name="contactName"
              type="text"
              required
              autoComplete="name"
              placeholder="Full name"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Company name</span>
            <input
              name="companyName"
              type="text"
              required
              autoComplete="organization"
              placeholder="Legal or trading name"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Address</span>
            <textarea
              name="address"
              required
              rows={3}
              minLength={5}
              autoComplete="street-address"
              placeholder="Street, city, region, postal code, country"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Email</span>
            <input
              name="contactEmail"
              type="email"
              required
              autoComplete="email"
              placeholder="you@company.com"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Phone number</span>
            <input
              name="phoneNumber"
              type="tel"
              required
              autoComplete="tel"
              placeholder="Include country code if outside your region"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Processor</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            Same controller models as in Projects (U / X100 Pro / Z / VX / DS / S series).
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Processor model</span>
            <select
              required
              value={processorModel}
              onChange={(e) => setProcessorModel(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">Select model</option>
              {sortedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Firmware version</span>
            <input
              type="text"
              required
              value={firmware}
              onChange={(e) => setFirmware(e.target.value)}
              placeholder="e.g. 2.3.1"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Serial number</span>
            <input
              name="serialNumber"
              type="text"
              required
              autoComplete="off"
              placeholder="Printed on the unit label"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Purchase</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Purchase number</span>
            <input
              name="purchaseNumber"
              type="text"
              required
              placeholder="Order or invoice reference"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">Date purchased</span>
            <input
              name="datePurchased"
              type="date"
              required
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Issue and environment</h2>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Description of the issue</span>
          <textarea
            name="issueDescription"
            required
            rows={5}
            minLength={10}
            placeholder="What failed or misbehaved? When did it start? Any error messages or LED patterns?"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Environment when the processor was used</span>
          <textarea
            name="usageEnvironment"
            required
            rows={4}
            minLength={10}
            placeholder="Indoor/outdoor, climate, rack or desktop, mains quality, video sources, receiver types, software versions, network setup, etc."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Photos of the issue (optional)</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            JPEG, PNG, WebP, GIF, or HEIC. Up to 12 files, 25MB each.
          </p>
        </div>
        <input name="issuePhotos" type="file" accept="image/*" multiple className={FILE_INPUT_CLASS} />
      </section>

      <section className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitState.status === "submitting" ? "Submitting..." : "Submit RMA for this processor"}
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
      </section>
    </form>
  );
}
