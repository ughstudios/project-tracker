"use client";

import { useI18n } from "@/i18n/context";
import type { TranslateFn } from "@/i18n/create-translator";
import { RGB_BPC_PRESETS, totalBppRgbPacked, type RgbBitsPerChannel } from "@/lib/led-bandwidth";
import {
  RECEIVER_CARD_CATALOG,
  cabinetPixelSize,
  cabinetsNeeded,
  cardsNeededByPixels,
  cardsPerCabinet,
  ledSignalMbps,
  portsNeededForMbps,
  receiverSupportsTarget,
  usableMbpsForPortSpeed,
  type ReceiverCardCatalogItem,
  type ReceiverPortSpeed,
} from "@/lib/receiver-card-planner";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

function parsePositiveInt(raw: string, fallback: number): number {
  const n = Number.parseInt(raw.replaceAll(/\s+/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function parsePositiveFloat(raw: string, fallback: number): number {
  const n = Number.parseFloat(raw.replaceAll(/\s+/g, "").replaceAll(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function depthSelectLabel(t: TranslateFn, bpc: RgbBitsPerChannel): string {
  return t("tools.depthOptionFmt", {
    bpc: String(bpc),
    bpp: String(totalBppRgbPacked(bpc)),
  });
}

function planningPortSpeed(card: ReceiverCardCatalogItem): Exclude<ReceiverPortSpeed, "unknown"> {
  return card.portSpeed === "5g" ? "5g" : "1g";
}

function cardPortSpeedLabel(t: TranslateFn, card: ReceiverCardCatalogItem): string {
  if (card.portSpeed === "5g") return t("tools.receiverPlanner.port5g");
  if (card.portSpeed === "1g") return t("tools.receiverPlanner.port1g");
  return t("tools.receiverPlanner.port1gAssumed");
}

function CapabilityChip({
  children,
  state,
}: {
  children: ReactNode;
  state: "ok" | "bad" | "unknown";
}) {
  const className =
    state === "ok"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
      : state === "bad"
        ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

  return <span className={["inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", className].join(" ")}>{children}</span>;
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/60">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</dd>
      <dd className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{note}</dd>
    </div>
  );
}

export function ReceiverCardPlannerTools() {
  const { t, locale } = useI18n();
  const nf0 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 0 }),
    [locale],
  );
  const nf1 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 1 }),
    [locale],
  );
  const nf2 = useMemo(
    () => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 }),
    [locale],
  );

  const [screenWStr, setScreenWStr] = useState("7680");
  const [screenHStr, setScreenHStr] = useState("2160");
  const [fpsStr, setFpsStr] = useState("120");
  const [rgbBpc, setRgbBpc] = useState<RgbBitsPerChannel>(10);
  const [cabinetWStr, setCabinetWStr] = useState("600");
  const [cabinetHStr, setCabinetHStr] = useState("337.5");
  const [pitchStr, setPitchStr] = useState("1.25");
  const [selectedCardName, setSelectedCardName] = useState("HC5");

  const selectedCard = RECEIVER_CARD_CATALOG.find((card) => card.name === selectedCardName) ?? RECEIVER_CARD_CATALOG[0]!;

  const screenW = parsePositiveInt(screenWStr, 0);
  const screenH = parsePositiveInt(screenHStr, 0);
  const fps = parsePositiveFloat(fpsStr, 0);
  const cabinetWmm = parsePositiveFloat(cabinetWStr, 0);
  const cabinetHmm = parsePositiveFloat(cabinetHStr, 0);
  const pitchMm = parsePositiveFloat(pitchStr, 0);

  const totalPixels = screenW * screenH;
  const requiredMbps = ledSignalMbps(screenW, screenH, fps, rgbBpc);
  const ports1g = portsNeededForMbps(requiredMbps, usableMbpsForPortSpeed("1g"));
  const ports5g = portsNeededForMbps(requiredMbps, usableMbpsForPortSpeed("5g"));
  const cabinetPixels = cabinetPixelSize(cabinetWmm, cabinetHmm, pitchMm);
  const cabinetGrid = cabinetsNeeded(screenW, screenH, cabinetPixels.width, cabinetPixels.height);
  const selectedCardsPerCabinet = cardsPerCabinet(cabinetPixels.pixels, selectedCard.maxCapacityPixels);
  const selectedPixelMinimum = cardsNeededByPixels(totalPixels, selectedCard.maxCapacityPixels);
  const selectedInstalledCards =
    cabinetGrid.total > 0 && selectedCardsPerCabinet > 0 ? cabinetGrid.total * selectedCardsPerCabinet : selectedPixelMinimum;
  const selectedSpeed = planningPortSpeed(selectedCard);
  const selectedPorts = portsNeededForMbps(requiredMbps, usableMbpsForPortSpeed(selectedSpeed));
  const selectedSupport = receiverSupportsTarget(selectedCard, fps, rgbBpc);

  const rows = RECEIVER_CARD_CATALOG.map((card) => {
    const support = receiverSupportsTarget(card, fps, rgbBpc);
    const perCabinet = cardsPerCabinet(cabinetPixels.pixels, card.maxCapacityPixels);
    const pixelMinimum = cardsNeededByPixels(totalPixels, card.maxCapacityPixels);
    const installedCards = cabinetGrid.total > 0 && perCabinet > 0 ? cabinetGrid.total * perCabinet : pixelMinimum;
    const portSpeed = planningPortSpeed(card);
    const ports = portsNeededForMbps(requiredMbps, usableMbpsForPortSpeed(portSpeed));

    return {
      card,
      support,
      perCabinet,
      pixelMinimum,
      installedCards,
      ports,
      exact: card.maxCapacityPixels > 0 && support.depthOk && support.frameOk,
    };
  });
  const exactRows = rows.filter((row) => row.exact);
  const candidates = exactRows.length > 0 ? exactRows : rows.filter((row) => row.card.maxCapacityPixels > 0);
  const recommendationRows = candidates
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (a.installedCards !== b.installedCards) return a.installedCards - b.installedCards;
      if (a.ports !== b.ports) return a.ports - b.ports;
      if (a.card.maxCapacityPixels !== b.card.maxCapacityPixels) return b.card.maxCapacityPixels - a.card.maxCapacityPixels;
      return a.card.name.localeCompare(b.card.name, undefined, { numeric: true });
    })
    .slice(0, 10);

  const hasExactRecommendations = recommendationRows.some((row) => row.exact);

  return (
    <div className="space-y-4">
      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.receiverPlanner.disclaimerTitle")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("tools.receiverPlanner.disclaimerBody")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
          <li>{t("tools.receiverPlanner.disclaimerBulletPorts")}</li>
          <li>{t("tools.receiverPlanner.disclaimerBulletCards")}</li>
          <li>{t("tools.receiverPlanner.disclaimerBulletController")}</li>
        </ul>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.receiverPlanner.formTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("tools.receiverPlanner.formSubtitle")}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelWidth")}</span>
            <input className="input w-full" inputMode="numeric" value={screenWStr} onChange={(e) => setScreenWStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelHeight")}</span>
            <input className="input w-full" inputMode="numeric" value={screenHStr} onChange={(e) => setScreenHStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.receiverPlanner.labelRefresh")}</span>
            <input className="input w-full" inputMode="decimal" value={fpsStr} onChange={(e) => setFpsStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.labelColorDepth")}</span>
            <select className="input w-full" value={rgbBpc} onChange={(e) => setRgbBpc(Number(e.target.value) as RgbBitsPerChannel)}>
              {RGB_BPC_PRESETS.map((bpc) => (
                <option key={bpc} value={bpc}>
                  {depthSelectLabel(t, bpc)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.receiverPlanner.labelCabinetWidth")}</span>
            <input className="input w-full" inputMode="decimal" value={cabinetWStr} onChange={(e) => setCabinetWStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.receiverPlanner.labelCabinetHeight")}</span>
            <input className="input w-full" inputMode="decimal" value={cabinetHStr} onChange={(e) => setCabinetHStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.receiverPlanner.labelPixelPitch")}</span>
            <input className="input w-full" inputMode="decimal" value={pitchStr} onChange={(e) => setPitchStr(e.target.value)} />
          </label>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.receiverPlanner.labelReceiverCard")}</span>
            <select className="input w-full" value={selectedCard.name} onChange={(e) => setSelectedCardName(e.target.value)}>
              {RECEIVER_CARD_CATALOG.map((card) => (
                <option key={card.name} value={card.name}>
                  {card.name} - {card.series}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">{t("tools.receiverPlanner.cabinetPixels")}</p>
            <p className="mt-1 tabular-nums text-zinc-600 dark:text-zinc-400">
              {t("tools.receiverPlanner.cabinetPixelsValue", {
                w: nf0.format(cabinetPixels.width),
                h: nf0.format(cabinetPixels.height),
                pixels: nf0.format(cabinetPixels.pixels),
              })}
            </p>
            <p className="mt-1 tabular-nums text-zinc-600 dark:text-zinc-400">
              {t("tools.receiverPlanner.cabinetGridValue", {
                across: nf0.format(cabinetGrid.across),
                tall: nf0.format(cabinetGrid.tall),
                total: nf0.format(cabinetGrid.total),
              })}
            </p>
          </div>
        </div>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.receiverPlanner.resultTitle")}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t("tools.receiverPlanner.resultSummary", {
                w: nf0.format(screenW),
                h: nf0.format(screenH),
                fps: nf1.format(fps),
                bpc: nf0.format(rgbBpc),
                mbps: nf1.format(requiredMbps),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <CapabilityChip state={selectedSupport.depthOk ? "ok" : selectedSupport.depthKnown ? "bad" : "unknown"}>
              {selectedSupport.depthKnown
                ? t("tools.receiverPlanner.depthBadge", { bpc: nf0.format(selectedCard.maxColorDepthBpc ?? 0) })
                : t("tools.receiverPlanner.depthUnknown")}
            </CapabilityChip>
            <CapabilityChip state={selectedSupport.frameOk ? "ok" : selectedSupport.frameKnown ? "bad" : "unknown"}>
              {selectedSupport.frameKnown
                ? t("tools.receiverPlanner.fpsBadge", { fps: nf1.format(selectedCard.maxFrameRateHz ?? 0) })
                : t("tools.receiverPlanner.fpsUnknown")}
            </CapabilityChip>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label={t("tools.receiverPlanner.metricPixels")}
            value={nf0.format(totalPixels)}
            note={t("tools.receiverPlanner.metricPixelsNote")}
          />
          <Metric
            label={t("tools.receiverPlanner.metricBandwidth")}
            value={`${nf2.format(requiredMbps / 1000)} Gbit/s`}
            note={t("tools.receiverPlanner.metricBandwidthNote")}
          />
          <Metric
            label={t("tools.receiverPlanner.metricPorts")}
            value={`${nf0.format(ports1g)} / ${nf0.format(ports5g)}`}
            note={t("tools.receiverPlanner.metricPortsNote")}
          />
          <Metric
            label={t("tools.receiverPlanner.metricSelectedPorts")}
            value={nf0.format(selectedPorts)}
            note={cardPortSpeedLabel(t, selectedCard)}
          />
          <Metric
            label={t("tools.receiverPlanner.metricCabinets")}
            value={nf0.format(cabinetGrid.total)}
            note={t("tools.receiverPlanner.metricCabinetsNote", {
              across: nf0.format(cabinetGrid.across),
              tall: nf0.format(cabinetGrid.tall),
            })}
          />
          <Metric
            label={t("tools.receiverPlanner.metricCardsPerCabinet")}
            value={nf0.format(selectedCardsPerCabinet)}
            note={t("tools.receiverPlanner.metricCardsPerCabinetNote", { card: selectedCard.name })}
          />
          <Metric
            label={t("tools.receiverPlanner.metricInstalledCards")}
            value={nf0.format(selectedInstalledCards)}
            note={t("tools.receiverPlanner.metricInstalledCardsNote")}
          />
          <Metric
            label={t("tools.receiverPlanner.metricPixelMinimum")}
            value={nf0.format(selectedPixelMinimum)}
            note={t("tools.receiverPlanner.metricPixelMinimumNote", { capacity: nf0.format(selectedCard.maxCapacityPixels) })}
          />
        </dl>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950">
          <p className="font-medium text-zinc-900 dark:text-zinc-100">{selectedCard.name}</p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {t("tools.receiverPlanner.selectedCardLine", {
              series: selectedCard.series,
              capacity: selectedCard.maxCapacityLabel,
              pixels: nf0.format(selectedCard.maxCapacityPixels),
            })}
          </p>
          {selectedCard.capacityText ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{selectedCard.capacityText}</p> : null}
        </div>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.receiverPlanner.recommendationsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {hasExactRecommendations ? t("tools.receiverPlanner.recommendationsSubtitle") : t("tools.receiverPlanner.noExactRecommendations")}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <tr>
                <th className="py-2 pr-3 font-semibold">{t("tools.receiverPlanner.tableCard")}</th>
                <th className="px-3 py-2 font-semibold">{t("tools.receiverPlanner.tableCapacity")}</th>
                <th className="px-3 py-2 font-semibold">{t("tools.receiverPlanner.tableCapability")}</th>
                <th className="px-3 py-2 font-semibold">{t("tools.receiverPlanner.tableCards")}</th>
                <th className="py-2 pl-3 font-semibold">{t("tools.receiverPlanner.tablePorts")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recommendationRows.map((row) => (
                <tr key={row.card.name} className="align-top">
                  <td className="py-3 pr-3">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.card.name}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.card.series}</p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{row.card.maxCapacityLabel}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t("tools.receiverPlanner.capacityPixels", { pixels: nf0.format(row.card.maxCapacityPixels) })}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      <CapabilityChip state={row.support.depthOk ? "ok" : row.support.depthKnown ? "bad" : "unknown"}>
                        {row.support.depthKnown
                          ? t("tools.receiverPlanner.depthBadge", { bpc: nf0.format(row.card.maxColorDepthBpc ?? 0) })
                          : t("tools.receiverPlanner.depthUnknown")}
                      </CapabilityChip>
                      <CapabilityChip state={row.support.frameOk ? "ok" : row.support.frameKnown ? "bad" : "unknown"}>
                        {row.support.frameKnown
                          ? t("tools.receiverPlanner.fpsBadge", { fps: nf1.format(row.card.maxFrameRateHz ?? 0) })
                          : t("tools.receiverPlanner.fpsUnknown")}
                      </CapabilityChip>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{nf0.format(row.installedCards)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t("tools.receiverPlanner.cardsBreakdown", {
                        perCabinet: nf0.format(row.perCabinet),
                        minimum: nf0.format(row.pixelMinimum),
                      })}
                    </p>
                  </td>
                  <td className="py-3 pl-3 tabular-nums">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{nf0.format(row.ports)}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{cardPortSpeedLabel(t, row.card)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
