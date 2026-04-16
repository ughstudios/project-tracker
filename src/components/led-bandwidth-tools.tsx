"use client";

import { useI18n } from "@/i18n/context";
import type { TranslateFn } from "@/i18n/create-translator";
import {
  DEFAULT_USABLE_MBPS_1G,
  DEFAULT_USABLE_MBPS_5G,
  FPS_REFERENCE,
  RGB_BPC_PRESETS,
  maxPixelsForLink,
  streamBandwidthMbps,
  totalBppRgbPacked,
  type RgbBitsPerChannel,
} from "@/lib/led-bandwidth";
import { useMemo, useState } from "react";

function parsePositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.replaceAll(/\s+/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePositiveFloat(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw.replaceAll(",", "."));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function depthSelectLabel(t: TranslateFn, bpc: RgbBitsPerChannel): string {
  return t("tools.depthOptionFmt", {
    bpc: String(bpc),
    bpp: String(totalBppRgbPacked(bpc)),
  });
}

export function LedBandwidthTools() {
  const { t, locale } = useI18n();
  const nf = useMemo(() => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US"), [locale]);
  const nf0 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 0 }),
    [locale],
  );
  const nf1 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 }),
    [locale],
  );

  const [wStr, setWStr] = useState("");
  const [hStr, setHStr] = useState("");
  const [pixelStr, setPixelStr] = useState("720000");
  const [fpsStr, setFpsStr] = useState("60");
  const [rgbBpc, setRgbBpc] = useState<RgbBitsPerChannel>(8);

  const [capMbpsStr, setCapMbpsStr] = useState(String(DEFAULT_USABLE_MBPS_1G));
  const [capFpsStr, setCapFpsStr] = useState("60");
  const [capRgbBpc, setCapRgbBpc] = useState<RgbBitsPerChannel>(8);

  const w = parsePositiveInt(wStr, 0);
  const h = parsePositiveInt(hStr, 0);
  const manualPixels = parsePositiveInt(pixelStr, 0);
  const fps = parsePositiveFloat(fpsStr, 60);
  const fromResolution = w > 0 && h > 0;
  const pixels = fromResolution ? w * h : manualPixels;

  const streamBpp = totalBppRgbPacked(rgbBpc);
  const streamMbps = streamBandwidthMbps(pixels, fps, streamBpp);
  const util1g = (streamMbps / DEFAULT_USABLE_MBPS_1G) * 100;
  const util5g = (streamMbps / DEFAULT_USABLE_MBPS_5G) * 100;
  const fits1g = streamMbps <= DEFAULT_USABLE_MBPS_1G;
  const fits5g = streamMbps <= DEFAULT_USABLE_MBPS_5G;

  const capMbps = parsePositiveFloat(capMbpsStr, DEFAULT_USABLE_MBPS_1G);
  const capFps = parsePositiveFloat(capFpsStr, 60);
  const capBpp = totalBppRgbPacked(capRgbBpc);
  const capMaxPx = maxPixelsForLink(capMbps, capFps, capBpp);
  const capSqrt = capMaxPx > 0 ? Math.floor(Math.sqrt(capMaxPx)) : 0;

  const utilClass = (pct: number) =>
    pct >= 100
      ? "text-red-600 dark:text-red-400"
      : pct >= 85
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";

  const refRows = useMemo(() => {
    const rows: { bpc: RgbBitsPerChannel; bpp: number; fps: number; max1g: number; max5g: number }[] = [];
    for (const bpc of RGB_BPC_PRESETS) {
      const bpp = totalBppRgbPacked(bpc);
      for (const f of FPS_REFERENCE) {
        rows.push({
          bpc,
          bpp,
          fps: f,
          max1g: maxPixelsForLink(DEFAULT_USABLE_MBPS_1G, f, bpp),
          max5g: maxPixelsForLink(DEFAULT_USABLE_MBPS_5G, f, bpp),
        });
      }
    }
    return rows;
  }, []);

  return (
    <div className="space-y-4">
      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.disclaimerTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("tools.disclaimerBody")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
          <li>{t("tools.disclaimerBullet1")}</li>
          <li>{t("tools.disclaimerBullet2")}</li>
          <li>{t("tools.disclaimerBullet3")}</li>
        </ul>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.refTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("tools.refSubtitle")}</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colPerColor")}</th>
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colBpp")}</th>
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colFps")}</th>
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colMax1g")}</th>
                <th className="py-2 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colMax5g")}</th>
              </tr>
            </thead>
            <tbody>
              {refRows.map((row) => (
                <tr key={`${row.bpc}-${row.fps}`} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3 tabular-nums text-zinc-800 dark:text-zinc-200">{nf0.format(row.bpc)}</td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-800 dark:text-zinc-200">{nf0.format(row.bpp)}</td>
                  <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">{nf0.format(row.fps)}</td>
                  <td className="py-2 pr-3 tabular-nums text-zinc-700 dark:text-zinc-300">{nf.format(row.max1g)}</td>
                  <td className="py-2 tabular-nums text-zinc-700 dark:text-zinc-300">{nf.format(row.max5g)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.streamTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("tools.streamHelp")}</p>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("tools.streamPixelBlockTitle")}
          </p>

          <p className="mt-3 text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("tools.streamResolutionTitle")}</p>
          <div className="mt-2 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-sm">
              <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelWidth")}</span>
              <input className="input w-full" inputMode="numeric" value={wStr} onChange={(e) => setWStr(e.target.value)} />
            </label>
            <span
              className="hidden pb-2 text-center text-lg text-zinc-400 sm:block sm:w-8"
              aria-hidden
            >
              ×
            </span>
            <label className="block min-w-0 flex-1 text-sm">
              <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelHeight")}</span>
              <input className="input w-full" inputMode="numeric" value={hStr} onChange={(e) => setHStr(e.target.value)} />
            </label>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{t("tools.streamResolutionHint")}</p>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-600" aria-hidden />
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {t("tools.streamOrDivider")}
            </span>
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-600" aria-hidden />
          </div>

          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("tools.streamTotalTitle")}</p>
          <label className="mt-2 block max-w-xl text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelTotalPixels")}</span>
            <input
              className="input w-full"
              inputMode="numeric"
              value={pixelStr}
              onChange={(e) => setPixelStr(e.target.value)}
              disabled={fromResolution}
            />
            <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
              {fromResolution ? t("tools.streamTotalDisabledHint") : t("tools.streamTotalHint")}
            </span>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelFps")}</span>
            <input className="input w-full" inputMode="decimal" value={fpsStr} onChange={(e) => setFpsStr(e.target.value)} />
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

        <p className="mt-4 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
          {fromResolution
            ? t("tools.streamActiveFromResolution", {
                w: nf0.format(w),
                h: nf0.format(h),
                pixels: nf.format(pixels),
              })
            : t("tools.streamActiveFromTotal", { pixels: nf.format(pixels) })}
        </p>

        <dl className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.outStreamMbps")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf1.format(streamMbps)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.portFitHeading")}
            </dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  fits1g
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
                ].join(" ")}
              >
                {t("tools.port1gBadge")}: {fits1g ? t("tools.portFitOk") : t("tools.portFitOver")}
              </span>
              <span
                className={[
                  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                  fits5g
                    ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
                ].join(" ")}
              >
                {t("tools.port5gBadge")}: {fits5g ? t("tools.portFitOk") : t("tools.portFitOver")}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.outUtil1g", { mbps: nf0.format(DEFAULT_USABLE_MBPS_1G) })}
            </dt>
            <dd className={["mt-1 text-lg font-semibold tabular-nums", utilClass(util1g)].join(" ")}>{nf1.format(util1g)}%</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.outUtil5g", { mbps: nf0.format(DEFAULT_USABLE_MBPS_5G) })}
            </dt>
            <dd className={["mt-1 text-lg font-semibold tabular-nums", utilClass(util5g)].join(" ")}>{nf1.format(util5g)}%</dd>
          </div>
        </dl>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.capacityTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("tools.capacityHelp")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setCapMbpsStr(String(DEFAULT_USABLE_MBPS_1G))}
          >
            {t("tools.preset1g")}
          </button>
          <button
            type="button"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            onClick={() => setCapMbpsStr(String(DEFAULT_USABLE_MBPS_5G))}
          >
            {t("tools.preset5g")}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-3">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelUsableMbps")}</span>
            <input className="input w-full max-w-xs" inputMode="decimal" value={capMbpsStr} onChange={(e) => setCapMbpsStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelFps")}</span>
            <input className="input w-full" inputMode="decimal" value={capFpsStr} onChange={(e) => setCapFpsStr(e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelColorDepth")}</span>
            <select
              className="input w-full max-w-xs"
              value={capRgbBpc}
              onChange={(e) => setCapRgbBpc(Number(e.target.value) as RgbBitsPerChannel)}
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
        <dl className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            {t("tools.outMaxPixels")}
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf.format(capMaxPx)}</dd>
          <dd className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {t("tools.squareHint", { n: nf.format(capSqrt), product: nf.format(capSqrt * capSqrt) })}
          </dd>
        </dl>
      </section>
    </div>
  );
}
