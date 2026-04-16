"use client";

import { useI18n } from "@/i18n/context";
import {
  DISPLAY_INTERFACE_MAX_GBPS,
  DEFAULT_DISPLAY_TIMING_OVERHEAD,
  requiredVideoGbps,
  type DisplayInterfaceId,
} from "@/lib/display-interface-specs";
import { RGB_BPC_PRESETS, totalBppRgbPacked, type RgbBitsPerChannel } from "@/lib/led-bandwidth";
import type { TranslateFn } from "@/i18n/create-translator";
import { useMemo, useState } from "react";

function depthSelectLabel(t: TranslateFn, bpc: RgbBitsPerChannel): string {
  return t("tools.depthOptionFmt", {
    bpc: String(bpc),
    bpp: String(totalBppRgbPacked(bpc)),
  });
}

function parsePositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.replaceAll(/\s+/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePositiveFloat(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw.replaceAll(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const HDMI_IDS: DisplayInterfaceId[] = ["hdmi-1-4", "hdmi-2-0", "hdmi-2-1"];
const DP_IDS: DisplayInterfaceId[] = ["dp-1-2", "dp-1-4", "dp-2-0"];

export function HdmiDpCompatibilityTools() {
  const { t, locale } = useI18n();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US"), [locale]);
  const nf1 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 }),
    [locale],
  );
  const nf2 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 }),
    [locale],
  );

  const [iface, setIface] = useState<DisplayInterfaceId>("hdmi-2-0");
  const [wStr, setWStr] = useState("1920");
  const [hStr, setHStr] = useState("1080");
  const [hzStr, setHzStr] = useState("60");
  const [rgbBpc, setRgbBpc] = useState<RgbBitsPerChannel>(8);

  const w = parsePositiveInt(wStr, 0);
  const h = parsePositiveInt(hStr, 0);
  const hz = parsePositiveFloat(hzStr, 60);
  const bpp = totalBppRgbPacked(rgbBpc);
  const maxGbps = DISPLAY_INTERFACE_MAX_GBPS[iface];
  const needGbps = requiredVideoGbps(w, h, hz, bpp, DEFAULT_DISPLAY_TIMING_OVERHEAD);
  const utilPct = maxGbps > 0 ? (needGbps / maxGbps) * 100 : 0;
  const fits = needGbps <= maxGbps;

  const utilClass =
    utilPct >= 100
      ? "text-red-600 dark:text-red-400"
      : utilPct >= 85
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";

  return (
    <div className="space-y-4">
      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.displayIo.disclaimerTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("tools.displayIo.disclaimerBody")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
          <li>{t("tools.displayIo.disclaimerBullet1")}</li>
          <li>{t("tools.displayIo.disclaimerBullet2")}</li>
          <li>{t("tools.displayIo.disclaimerBullet3")}</li>
        </ul>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.displayIo.formTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("tools.displayIo.formSubtitle")}</p>

        <label className="mt-4 block max-w-xl text-sm">
          <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.displayIo.labelInterface")}</span>
          <select
            className="input w-full"
            value={iface}
            onChange={(e) => setIface(e.target.value as DisplayInterfaceId)}
          >
            <optgroup label={t("tools.displayIo.groupHdmi")}>
              {HDMI_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`tools.displayIo.ifaces.${id}`)}
                </option>
              ))}
            </optgroup>
            <optgroup label={t("tools.displayIo.groupDp")}>
              {DP_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`tools.displayIo.ifaces.${id}`)}
                </option>
              ))}
            </optgroup>
          </select>
          <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
            {t("tools.displayIo.interfaceMaxHint", { gbps: nf2.format(maxGbps) })}
          </span>
        </label>

        <div className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelWidth")}</span>
            <input className="input w-full" inputMode="numeric" value={wStr} onChange={(e) => setWStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelHeight")}</span>
            <input className="input w-full" inputMode="numeric" value={hStr} onChange={(e) => setHStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.displayIo.labelHz")}</span>
            <input className="input w-full" inputMode="decimal" value={hzStr} onChange={(e) => setHzStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelColorDepth")}</span>
            <select
              className="input w-full"
              value={rgbBpc}
              onChange={(e) => setRgbBpc(Number(e.target.value) as RgbBitsPerChannel)}
            >
              {RGB_BPC_PRESETS.map((bpc) => (
                <option key={bpc} value={bpc}>
                  {depthSelectLabel(t, bpc)}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">{t("tools.depthFieldHint")}</span>
          </label>
        </div>

        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t("tools.displayIo.overheadNote")}</p>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.displayIo.resultTitle")}</h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {t("tools.displayIo.resultSummary", {
            w: nf.format(w),
            h: nf.format(h),
            hz: nf1.format(hz),
            need: nf2.format(needGbps),
            max: nf2.format(maxGbps),
          })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
              fits
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
            ].join(" ")}
          >
            {fits ? t("tools.displayIo.badgeOk") : t("tools.displayIo.badgeOver")}
          </span>
          <span className={["text-sm font-medium tabular-nums", utilClass].join(" ")}>
            {t("tools.displayIo.utilLine", { pct: nf1.format(utilPct) })}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.displayIo.outRequired")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf2.format(needGbps)}</dd>
            <dd className="text-xs text-zinc-500 dark:text-zinc-400">Gbit/s ({t("tools.displayIo.withOverhead")})</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.displayIo.outCeiling")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf2.format(maxGbps)}</dd>
            <dd className="text-xs text-zinc-500 dark:text-zinc-400">{t("tools.displayIo.ceilingHelp")}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
