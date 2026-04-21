"use client";

import { useI18n } from "@/i18n/context";
import {
  MAILING_ADDRESS_COUNTRY_OTHER,
  mailingAddressCountryOptions,
} from "@/lib/mailing-address";
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
  const { t, locale } = useI18n();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [processorModel, setProcessorModel] = useState("");
  const [firmware, setFirmware] = useState("");
  const [countryCode, setCountryCode] = useState("");

  const sortedModels = useMemo(() => [...PROCESSOR_MODELS].sort((a, b) => a.localeCompare(b)), []);

  const canSubmit = submitState.status !== "submitting";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!processorModel.trim()) {
      setSubmitState({ status: "error", message: t("publicForms.processorRma.client.selectProcessor") });
      return;
    }
    if (!countryCode) {
      setSubmitState({ status: "error", message: t("publicForms.processorRma.client.selectCountry") });
      return;
    }

    const formEl = event.currentTarget;
    const formData = new FormData(formEl);
    if (countryCode === MAILING_ADDRESS_COUNTRY_OTHER) {
      const otherRaw = formData.get("countryOther");
      const other = typeof otherRaw === "string" ? otherRaw.trim() : "";
      if (other.length < 2) {
        setSubmitState({ status: "error", message: t("publicForms.processorRma.client.countryOtherRequired") });
        return;
      }
    }
    formData.set("locale", locale);
    formData.set("processorModel", processorModel.trim());
    formData.set("firmware", firmware.trim());

    setSubmitState({ status: "submitting", message: t("publicForms.processorRma.submitting") });
    const response = await fetch("/api/public/forms/processor-rma", {
      method: "POST",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      attachmentWarnings?: string[];
    };

    if (!response.ok) {
      setSubmitState({
        status: "error",
        message: payload.error ?? t("publicForms.processorRma.client.submitFailed"),
      });
      return;
    }

    formEl.reset();
    setProcessorModel("");
    setFirmware("");
    setCountryCode("");
    let successMessage = payload.message ?? t("publicForms.processorRma.client.successDefault");
    if (payload.attachmentWarnings?.length) {
      successMessage += `\n\n${payload.attachmentWarnings.join("\n")}`;
    }
    setSubmitState({
      status: "success",
      message: successMessage,
    });
  }

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-100">
        <p className="font-semibold">{t("publicForms.processorRma.noticeTitle")}</p>
        <p className="mt-1 text-sky-900/90 dark:text-sky-200/90">{t("publicForms.processorRma.noticeBody")}</p>
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.processorRma.contactTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.processorRma.contactLead")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.contactName")}</span>
            <input
              name="contactName"
              type="text"
              required
              autoComplete="name"
              placeholder={t("publicForms.processorRma.fullNamePh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.companyName")}</span>
            <input
              name="companyName"
              type="text"
              required
              autoComplete="organization"
              placeholder={t("publicForms.processorRma.companyNamePh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <div className="md:col-span-2 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("publicForms.processorRma.mailingAddress")}
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.addressLine1")}</span>
              <input
                name="addressLine1"
                type="text"
                required
                autoComplete="address-line1"
                placeholder={t("publicForms.processorRma.addressLine1Ph")}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {t("publicForms.processorRma.addressLine2")}{" "}
                <span className="font-normal text-zinc-500 dark:text-zinc-400">{t("common.optional")}</span>
              </span>
              <input
                name="addressLine2"
                type="text"
                autoComplete="address-line2"
                placeholder={t("publicForms.processorRma.addressLine2Ph")}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.city")}</span>
                <input
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.stateProvince")}</span>
                <input
                  name="stateProvince"
                  type="text"
                  required
                  autoComplete="address-level1"
                  placeholder={t("publicForms.processorRma.stateProvincePh")}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.postalCode")}</span>
                <input
                  name="postalCode"
                  type="text"
                  required
                  autoComplete="postal-code"
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.country")}</span>
                <select
                  name="countryCode"
                  required
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  autoComplete="country"
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <option value="">{t("publicForms.processorRma.selectCountry")}</option>
                  {mailingAddressCountryOptions.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {countryCode === MAILING_ADDRESS_COUNTRY_OTHER ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.countryName")}</span>
                <input
                  id="rma-country-other"
                  name="countryOther"
                  type="text"
                  required
                  placeholder={t("publicForms.processorRma.countryNamePh")}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            ) : null}
          </div>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.email")}</span>
            <input
              name="contactEmail"
              type="email"
              required
              autoComplete="email"
              placeholder={t("publicForms.processorRma.emailPh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.phone")}</span>
            <input
              name="phoneNumber"
              type="tel"
              required
              autoComplete="tel"
              placeholder={t("publicForms.processorRma.phonePh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.processorRma.processorTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.processorRma.processorLead")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.processorModel")}</span>
            <select
              required
              value={processorModel}
              onChange={(e) => setProcessorModel(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{t("publicForms.processorRma.selectModel")}</option>
              {sortedModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {t("publicForms.processorRma.firmwareVersion")}{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">{t("common.optional")}</span>
            </span>
            <input
              type="text"
              value={firmware}
              onChange={(e) => setFirmware(e.target.value)}
              placeholder={t("publicForms.processorRma.firmwarePh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm md:col-span-2">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.serialNumber")}</span>
            <input
              name="serialNumber"
              type="text"
              required
              autoComplete="off"
              placeholder={t("publicForms.processorRma.serialPh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.processorRma.purchaseTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.processorRma.purchaseLead")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">
              {t("publicForms.processorRma.purchaseOrder")}{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">{t("common.optional")}</span>
            </span>
            <input
              name="purchaseNumber"
              type="text"
              placeholder={t("publicForms.processorRma.purchaseOrderPh")}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.datePurchased")}</span>
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
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.processorRma.issueTitle")}</h2>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.issueDescription")}</span>
          <textarea
            name="issueDescription"
            required
            rows={5}
            minLength={10}
            placeholder={t("publicForms.processorRma.issueDescriptionPh")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="mt-4 flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-zinc-800 dark:text-zinc-200">{t("publicForms.processorRma.usageEnvironment")}</span>
          <textarea
            name="usageEnvironment"
            required
            rows={4}
            minLength={10}
            placeholder={t("publicForms.processorRma.usageEnvironmentPh")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
      </section>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="mb-3">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("publicForms.processorRma.photosTitle")}</h2>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{t("publicForms.processorRma.photosLead")}</p>
        </div>
        <input name="issuePhotos" type="file" accept="image/*" multiple className={FILE_INPUT_CLASS} />
      </section>

      <section className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {submitState.status === "submitting" ? t("publicForms.processorRma.submitting") : t("publicForms.processorRma.submit")}
        </button>
        {submitState.status !== "idle" ? (
          <p
            className={[
              "max-w-3xl text-sm whitespace-pre-line",
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
