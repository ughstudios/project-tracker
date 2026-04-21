"use client";

import { useI18n } from "@/i18n/context";
import { FormEvent, useState } from "react";

const CALIBRATION_OPTIONS = [
  { id: "single-layer", messageKey: "publicForms.calibration.options.singleLayer" as const },
  { id: "double-layer", messageKey: "publicForms.calibration.options.doubleLayer" as const },
  { id: "low-chip-brightness", messageKey: "publicForms.calibration.options.lowChipBrightness" as const },
  { id: "grayscale-infibit", messageKey: "publicForms.calibration.options.grayscaleInfibit" as const },
] as const;

type SubmitState =
  | { status: "idle"; message?: string }
  | { status: "submitting"; message?: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ControllerConfig = { model: string; firmware: string; quantity: number };
type ReceiverConfig = { model: string; firmware: string; quantity: number };

const CONTROLLER_MODELS = [
  "U15",
  "U6",
  "U9",
  "X100 Pro 4U",
  "X100 Pro 2U",
  "X100 Pro 7U",
  "Z8t",
  "Z6 Pro G2",
  "Z5",
  "Z4 Pro",
  "Z3",
  "VX20",
  "VX12F",
  "VX10",
  "VX6",
  "DS40",
  "DS20",
  "DS420",
  "DS410",
  "S20",
  "S6F",
  "S20F",
  "S4",
  "S6",
] as const;

const RECEIVER_MODELS = [
  "5G Series - HC5",
  "5G Series - RV5000",
  "K10",
  "K5+",
  "K8",
  "E320 Pro",
  "E120",
  "E80",
  "5A-75E",
  "5A-75B",
] as const;

const FILE_INPUT_CLASS =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white file:transition-colors hover:file:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:file:bg-zinc-100 dark:file:text-zinc-900 dark:hover:file:bg-zinc-300";

function hasAnyControllerField(item: ControllerConfig): boolean {
  return item.model.trim() !== "" || item.firmware.trim() !== "" || item.quantity !== 1;
}

function hasAnyReceiverField(item: ReceiverConfig): boolean {
  return item.model.trim() !== "" || item.firmware.trim() !== "" || item.quantity !== 1;
}

export function PublicCalibrationRequestForm() {
  const { t, locale } = useI18n();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [controllers, setControllers] = useState<ControllerConfig[]>([
    { model: "", firmware: "", quantity: 1 },
  ]);
  const [receivers, setReceivers] = useState<ReceiverConfig[]>([
    { model: "", firmware: "", quantity: 1 },
  ]);

  const canSubmit = submitState.status !== "submitting";

  function toggleType(id: string) {
    setSelectedTypes((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedTypes.length === 0) {
      setSubmitState({
        status: "error",
        message: t("publicForms.calibration.client.selectCalibration"),
      });
      return;
    }

    const controllersWithAnyInput = controllers.filter(hasAnyControllerField);
    const receiversWithAnyInput = receivers.filter(hasAnyReceiverField);

    if (controllersWithAnyInput.length === 0) {
      setSubmitState({
        status: "error",
        message: t("publicForms.calibration.client.controllersEmpty"),
      });
      return;
    }
    if (receiversWithAnyInput.length === 0) {
      setSubmitState({
        status: "error",
        message: t("publicForms.calibration.client.receiversEmpty"),
      });
      return;
    }

    const invalidController = controllersWithAnyInput.some(
      (item) => !item.model.trim() || !item.firmware.trim() || !Number.isFinite(item.quantity) || item.quantity < 1,
    );
    if (invalidController) {
      setSubmitState({
        status: "error",
        message: t("publicForms.calibration.client.controllerLineInvalid"),
      });
      return;
    }

    const invalidReceiver = receiversWithAnyInput.some(
      (item) => !item.model.trim() || !item.firmware.trim() || !Number.isFinite(item.quantity) || item.quantity < 1,
    );
    if (invalidReceiver) {
      setSubmitState({
        status: "error",
        message: t("publicForms.calibration.client.receiverLineInvalid"),
      });
      return;
    }

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    formData.set("locale", locale);
    selectedTypes.forEach((type) => formData.append("calibrationTypes", type));
    formData.set("controllerConfigs", JSON.stringify(controllersWithAnyInput));
    formData.set("receiverCardConfigs", JSON.stringify(receiversWithAnyInput));

    setSubmitState({ status: "submitting", message: t("publicForms.calibration.submitting") });
    const response = await fetch("/api/public/forms/calibration", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

    if (!response.ok) {
      setSubmitState({
        status: "error",
        message: payload.error ?? t("publicForms.calibration.client.submitFailed"),
      });
      return;
    }

    formEl.reset();
    setSelectedTypes([]);
    setControllers([{ model: "", firmware: "", quantity: 1 }]);
    setReceivers([{ model: "", firmware: "", quantity: 1 }]);
    setSubmitState({
      status: "success",
      message: payload.message ?? t("publicForms.calibration.client.successDefault"),
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.calibration.typeTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.calibration.typeLead")}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CALIBRATION_OPTIONS.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-zinc-900 dark:accent-zinc-100"
                checked={selectedTypes.includes(option.id)}
                onChange={() => toggleType(option.id)}
              />
              <span>{t(option.messageKey)}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.calibration.screenTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.calibration.screenLead")}</p>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.calibration.screenResolution")}</span>
          <input
            name="screenResolution"
            type="text"
            required
            placeholder={t("publicForms.calibration.screenResolutionPh")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.calibration.screenType")}</span>
          <input
            name="screenType"
            type="text"
            required
            placeholder={t("publicForms.calibration.screenTypePh")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.calibration.controllersTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.calibration.controllersLead")}</p>
        </div>
        <div className="space-y-2.5">
          {controllers.map((item, idx) => (
            <div
              key={`controller-${idx}`}
              className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(84px,0.7fr)_120px] dark:border-zinc-800 dark:bg-zinc-900/30"
            >
              <select
                value={item.model}
                onChange={(e) =>
                  setControllers((prev) =>
                    prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, model: e.target.value } : line)),
                  )
                }
                className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">{t("publicForms.calibration.selectControllerModel")}</option>
                {CONTROLLER_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("publicForms.calibration.firmwarePh")}
                value={item.firmware}
                onChange={(e) =>
                  setControllers((prev) =>
                    prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, firmware: e.target.value } : line)),
                  )
                }
                className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  setControllers((prev) =>
                    prev.map((line, lineIdx) =>
                      lineIdx === idx
                        ? { ...line, quantity: Math.max(1, Number.parseInt(e.target.value || "1", 10) || 1) }
                        : line,
                    ),
                  )
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() =>
                  setControllers((prev) => (prev.length > 1 ? prev.filter((_, lineIdx) => lineIdx !== idx) : prev))
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 lg:w-[120px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {t("publicForms.calibration.remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setControllers((prev) => [...prev, { model: "", firmware: "", quantity: 1 }])}
          className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {t("publicForms.calibration.addControllerLine")}
        </button>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.calibration.receiversTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.calibration.receiversLead")}</p>
        </div>
        <div className="space-y-2.5">
          {receivers.map((item, idx) => (
            <div
              key={`receiver-${idx}`}
              className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(84px,0.7fr)_120px] dark:border-zinc-800 dark:bg-zinc-900/30"
            >
              <select
                value={item.model}
                onChange={(e) =>
                  setReceivers((prev) =>
                    prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, model: e.target.value } : line)),
                  )
                }
                className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="">{t("publicForms.calibration.selectReceiverModel")}</option>
                {RECEIVER_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder={t("publicForms.calibration.firmwarePh")}
                value={item.firmware}
                onChange={(e) =>
                  setReceivers((prev) =>
                    prev.map((line, lineIdx) => (lineIdx === idx ? { ...line, firmware: e.target.value } : line)),
                  )
                }
                className="min-w-0 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                type="number"
                min={1}
                value={item.quantity}
                onChange={(e) =>
                  setReceivers((prev) =>
                    prev.map((line, lineIdx) =>
                      lineIdx === idx
                        ? { ...line, quantity: Math.max(1, Number.parseInt(e.target.value || "1", 10) || 1) }
                        : line,
                    ),
                  )
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="button"
                onClick={() =>
                  setReceivers((prev) => (prev.length > 1 ? prev.filter((_, lineIdx) => lineIdx !== idx) : prev))
                }
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 lg:w-[120px] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                {t("publicForms.calibration.remove")}
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setReceivers((prev) => [...prev, { model: "", firmware: "", quantity: 1 }])}
          className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {t("publicForms.calibration.addReceiverLine")}
        </button>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.calibration.photosTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.calibration.photosLead")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.calibration.photoScreen")}</span>
            <input
              name="screenPhoto"
              type="file"
              accept="image/*"
              required
              className={FILE_INPUT_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.calibration.photoThreeScreens")}</span>
            <input
              name="screenPhotosExtra"
              type="file"
              accept="image/*"
              multiple
              required
              className={FILE_INPUT_CLASS}
            />
          </label>
        </div>
        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.calibration.photoWorkEnvironment")}</span>
          <input
            name="workEnvironmentPhotos"
            type="file"
            accept="image/*"
            multiple
            required
            className={FILE_INPUT_CLASS}
          />
        </label>
      </section>

      <section className="flex items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitState.status === "submitting" ? t("publicForms.calibration.submitting") : t("publicForms.calibration.submit")}
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
