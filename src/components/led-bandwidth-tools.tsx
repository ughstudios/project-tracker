"use client";

import { useI18n } from "@/i18n/context";
import {
  BPP_PRESETS,
  DEFAULT_USABLE_MBPS_1G,
  DEFAULT_USABLE_MBPS_5G,
  FPS_REFERENCE,
  maxPixelsForLink,
  streamBandwidthMbps,
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
  const [bpp, setBpp] = useState<8 | 16 | 24>(24);

  const [capMbpsStr, setCapMbpsStr] = useState(String(DEFAULT_USABLE_MBPS_1G));
  const [capFpsStr, setCapFpsStr] = useState("60");
  const [capBpp, setCapBpp] = useState<8 | 16 | 24>(24);

  const w = parsePositiveInt(wStr, 0);
  const h = parsePositiveInt(hStr, 0);
  const manualPixels = parsePositiveInt(pixelStr, 0);
  const fps = parsePositiveFloat(fpsStr, 60);
  const pixels = w > 0 && h > 0 ? w * h : manualPixels;

  const streamMbps = streamBandwidthMbps(pixels, fps, bpp);
  const util1g = (streamMbps / DEFAULT_USABLE_MBPS_1G) * 100;
  const util5g = (streamMbps / DEFAULT_USABLE_MBPS_5G) * 100;

  const capMbps = parsePositiveFloat(capMbpsStr, DEFAULT_USABLE_MBPS_1G);
  const capFps = parsePositiveFloat(capFpsStr, 60);
  const capMaxPx = maxPixelsForLink(capMbps, capFps, capBpp);
  const capSqrt = capMaxPx > 0 ? Math.floor(Math.sqrt(capMaxPx)) : 0;

  const utilClass = (pct: number) =>
    pct >= 100
      ? "text-red-600 dark:text-red-400"
      : pct >= 85
        ? "text-amber-700 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";

  const refRows = useMemo(() => {
    const rows: { bpp: 8 | 16 | 24; fps: number; max1g: number; max5g: number }[] = [];
    for (const b of BPP_PRESETS) {
      for (const f of FPS_REFERENCE) {
        rows.push({
          bpp: b,
          fps: f,
          max1g: maxPixelsForLink(DEFAULT_USABLE_MBPS_1G, f, b),
          max5g: maxPixelsForLink(DEFAULT_USABLE_MBPS_5G, f, b),
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
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colBpp")}</th>
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colFps")}</th>
                <th className="py-2 pr-3 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colMax1g")}</th>
                <th className="py-2 font-medium text-zinc-900 dark:text-zinc-100">{t("tools.colMax5g")}</th>
              </tr>
            </thead>
            <tbody>
              {refRows.map((row) => (
                <tr key={`${row.bpp}-${row.fps}`} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">{row.bpp}</td>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelWidth")}</span>
            <input className="input w-full" inputMode="numeric" value={wStr} onChange={(e) => setWStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelHeight")}</span>
            <input className="input w-full" inputMode="numeric" value={hStr} onChange={(e) => setHStr(e.target.value)} />
          </label>
          <label className="block text-sm sm:col-span-2 lg:col-span-2">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelPixels")}</span>
            <input
              className="input w-full"
              inputMode="numeric"
              value={pixelStr}
              onChange={(e) => setPixelStr(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelFps")}</span>
            <input className="input w-full" inputMode="decimal" value={fpsStr} onChange={(e) => setFpsStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelBpp")}</span>
            <select className="input w-full" value={bpp} onChange={(e) => setBpp(Number(e.target.value) as 8 | 16 | 24)}>
              {BPP_PRESETS.map((b) => (
                <option key={b} value={b}>
                  {t(`tools.bppOption.${b}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{t("tools.streamPixelsNote")}</p>

        <dl className="mt-4 grid gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.outEffectivePixels")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf.format(pixels)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {t("tools.outStreamMbps")}
            </dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{nf1.format(streamMbps)}</dd>
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
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelBpp")}</span>
            <select className="input w-full max-w-xs" value={capBpp} onChange={(e) => setCapBpp(Number(e.target.value) as 8 | 16 | 24)}>
              {BPP_PRESETS.map((b) => (
                <option key={b} value={b}>
                  {t(`tools.bppOption.${b}`)}
                </option>
              ))}
            </select>
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
