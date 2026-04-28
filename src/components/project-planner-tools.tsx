"use client";

import { useI18n } from "@/i18n/context";
import type { TranslateFn } from "@/i18n/create-translator";
import { RGB_BPC_PRESETS, totalBppRgbPacked, type RgbBitsPerChannel } from "@/lib/led-bandwidth";
import {
  RECEIVER_CARD_CATALOG,
  SENDER_PROCESSOR_CATALOG,
  cabinetPixelSize,
  cabinetsNeeded,
  cardsNeededByPixels,
  cardsPerCabinet,
  ledSignalMbps,
  outputModesForPreference,
  pickProcessorOutput,
  portsNeededForMbps,
  processorMeetsRequirement,
  processorSupportsTarget,
  recommendProcessorInputBoard,
  recommendProcessorOutputBoard,
  requiredPortsForProcessorOutput,
  receiverMeetsRequirement,
  receiverSupportsTarget,
  usableMbpsForPortSpeed,
  type ProcessorOutputMode,
  type ProjectOutputPreference,
  type ProjectRequirement,
  type ReceiverCardCatalogItem,
  type ReceiverPortSpeed,
} from "@/lib/project-planner";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const REQUIREMENTS: ProjectRequirement[] = ["hdr", "lowLatency", "redundancy", "monitoring"];

const PLANNER_FALLBACK_TEXT: Record<string, string> = {
  "tools.projectPlanner.recommendedChoice": "Recommended starting point",
  "tools.projectPlanner.optionLabel": "Option {rank}",
  "tools.projectPlanner.exactReason": "This pairing clears the signal, output, feature, and receiver-card capacity checks entered above.",
  "tools.projectPlanner.reviewReason": "This pairing is close, but at least one capability or feature requirement should be checked before quoting it.",
  "tools.projectPlanner.guideWhy": "Why it works",
  "tools.projectPlanner.guideInstall": "Install count",
  "tools.projectPlanner.guideSignal": "Signal plan",
  "tools.projectPlanner.guideVerify": "Before quoting",
  "tools.projectPlanner.outputCapacityLine": "{output}: needs {required} ports, has {available}, and supports {capacity} pixels.",
  "tools.projectPlanner.cardsInstallLine": "Plan {cards} receiver cards: {perCabinet} per cabinet, with {minimum} as the pixel-only minimum.",
  "tools.projectPlanner.bandwidthLine": "{gbps} Gbit/s active RGB payload, planned around {mode}.",
  "tools.projectPlanner.verifyCards": "Confirm scan type, cabinet wiring, calibration mode, and receiver-card version against the real cabinet design.",
  "tools.projectPlanner.verifyReview": "Review {misses} unmet feature/capability checks, then confirm cabinet mapping and product availability.",
};

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

function modeLabel(t: TranslateFn, mode: ProcessorOutputMode | ReceiverPortSpeed): string {
  if (mode === "5g") return t("tools.projectPlanner.port5g");
  if (mode === "10g") return t("tools.projectPlanner.port10g");
  if (mode === "unknown") return t("tools.projectPlanner.port1gAssumed");
  return t("tools.projectPlanner.port1g");
}

function BoardLine({
  label,
  name,
  model,
  quantity,
  maxBoards,
  withinLimit,
}: {
  label: string;
  name: string;
  model: string;
  quantity: number;
  maxBoards: number;
  withinLimit: boolean;
}) {
  return (
    <p className={withinLimit ? "text-xs text-zinc-500 dark:text-zinc-400" : "text-xs text-red-700 dark:text-red-300"}>
      <span className="font-medium">{label}</span>{" "}
      {quantity} x {name} ({model}) - {quantity}/{maxBoards}
    </p>
  );
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

function LessonLine({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{children}</dd>
    </div>
  );
}

export function ProjectPlannerTools() {
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
  const [outputPreference, setOutputPreference] = useState<ProjectOutputPreference>("1g");
  const [requirements, setRequirements] = useState<ProjectRequirement[]>(["hdr", "lowLatency"]);

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

  const projectRows = RECEIVER_CARD_CATALOG.flatMap((card) => {
    const receiverSpeed = planningPortSpeed(card);
    const allowedModes = outputModesForPreference(outputPreference);
    const outputMode = allowedModes.includes(receiverSpeed) ? receiverSpeed : allowedModes[0] ?? receiverSpeed;
    const support = receiverSupportsTarget(card, fps, rgbBpc);
    const perCabinet = cardsPerCabinet(cabinetPixels.pixels, card.maxCapacityPixels);
    const pixelMinimum = cardsNeededByPixels(totalPixels, card.maxCapacityPixels);
    const installedCards = cabinetGrid.total > 0 && perCabinet > 0 ? cabinetGrid.total * perCabinet : pixelMinimum;
    const receiverRequirementHits = requirements.filter((requirement) => receiverMeetsRequirement(card, requirement)).length;
    const receiverExact =
      card.maxCapacityPixels > 0 &&
      support.depthOk &&
      support.frameOk &&
      receiverRequirementHits === requirements.length &&
      outputPreference === receiverSpeed;

    return SENDER_PROCESSOR_CATALOG.map((processor) => {
      const processorOutput = pickProcessorOutput(processor, totalPixels, requiredMbps, allowedModes);
      const requiredPorts = requiredPortsForProcessorOutput(processorOutput, requiredMbps);
      const processorSupport = processorSupportsTarget(processor, processorOutput, screenW, screenH, fps, rgbBpc);
      const processorRequirementHits = requirements.filter((requirement) => processorMeetsRequirement(processor, requirement)).length;
      const exact = receiverExact && processorSupport.exact && processorRequirementHits === requirements.length;
      const requirementMisses = requirements.length * 2 - receiverRequirementHits - processorRequirementHits;
      const inputBoard = recommendProcessorInputBoard(processor, screenW, screenH, fps);
      const outputBoard = recommendProcessorOutputBoard(processor, processorOutput, totalPixels, requiredPorts);

      return {
        card,
        processor,
        processorOutput,
        inputBoard,
        outputBoard,
        support,
        processorSupport,
        outputMode,
        requiredPorts,
        perCabinet,
        pixelMinimum,
        installedCards,
        exact,
        requirementMisses,
      };
    });
  });

  const viableRows = projectRows.filter((row) => row.processorOutput && row.card.maxCapacityPixels > 0);
  const recommendationRows = (viableRows.length > 0 ? viableRows : projectRows)
    .sort((a, b) => {
      if (a.exact !== b.exact) return a.exact ? -1 : 1;
      if (a.processorSupport.exact !== b.processorSupport.exact) return a.processorSupport.exact ? -1 : 1;
      if (a.requirementMisses !== b.requirementMisses) return a.requirementMisses - b.requirementMisses;
      if (a.installedCards !== b.installedCards) return a.installedCards - b.installedCards;
      if (a.requiredPorts !== b.requiredPorts) return a.requiredPorts - b.requiredPorts;
      if ((a.processorOutput?.capacityPixels ?? 0) !== (b.processorOutput?.capacityPixels ?? 0)) {
        return (a.processorOutput?.capacityPixels ?? Number.MAX_SAFE_INTEGER) - (b.processorOutput?.capacityPixels ?? Number.MAX_SAFE_INTEGER);
      }
      return `${a.processor.name} ${a.card.name}`.localeCompare(`${b.processor.name} ${b.card.name}`, undefined, { numeric: true });
    })
    .slice(0, 10);

  const best = recommendationRows[0];
  const hasExactRecommendations = recommendationRows.some((row) => row.exact);
  const translatedInputBoard = t("tools.projectPlanner.inputBoard");
  const translatedOutputBoard = t("tools.projectPlanner.outputBoard");
  const inputBoardLabel = translatedInputBoard === "tools.projectPlanner.inputBoard" ? "Input board" : translatedInputBoard;
  const outputBoardLabel = translatedOutputBoard === "tools.projectPlanner.outputBoard" ? "Output board" : translatedOutputBoard;

  function plannerText(path: string, vars?: Record<string, string>): string {
    const translated = t(path, vars);
    if (translated !== path) return translated;

    let fallback = PLANNER_FALLBACK_TEXT[path] ?? path;
    for (const [key, value] of Object.entries(vars ?? {})) {
      fallback = fallback.replaceAll(`{${key}}`, value);
    }
    return fallback;
  }

  function toggleRequirement(requirement: ProjectRequirement) {
    setRequirements((current) =>
      current.includes(requirement) ? current.filter((item) => item !== requirement) : [...current, requirement],
    );
  }

  return (
    <div className="space-y-4">
      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.projectPlanner.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{t("tools.projectPlanner.subtitle")}</p>
        <ul className="mt-2 list-inside list-disc text-sm text-zinc-600 dark:text-zinc-400">
          <li>{t("tools.projectPlanner.sourceNote")}</li>
          <li>{t("tools.projectPlanner.disclaimerBulletPorts")}</li>
          <li>{t("tools.projectPlanner.disclaimerBulletCards")}</li>
        </ul>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.projectPlanner.formTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{t("tools.projectPlanner.formSubtitle")}</p>

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
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.labelRefresh")}</span>
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

        <div className="mt-6 grid gap-3 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.labelCabinetWidth")}</span>
            <input className="input w-full" inputMode="decimal" value={cabinetWStr} onChange={(e) => setCabinetWStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.labelCabinetHeight")}</span>
            <input className="input w-full" inputMode="decimal" value={cabinetHStr} onChange={(e) => setCabinetHStr(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.labelPixelPitch")}</span>
            <input className="input w-full" inputMode="decimal" value={pitchStr} onChange={(e) => setPitchStr(e.target.value)} />
          </label>
          <fieldset className="block text-sm">
            <legend className="mb-1 font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.labelOutputPreference")}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <input
                  type="radio"
                  name="project-planner-output-set"
                  className="border-zinc-300 text-zinc-900"
                  checked={outputPreference === "1g"}
                  onChange={() => setOutputPreference("1g")}
                />
                {t("tools.projectPlanner.outputSet1g")}
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                <input
                  type="radio"
                  name="project-planner-output-set"
                  className="border-zinc-300 text-zinc-900"
                  checked={outputPreference === "5g"}
                  onChange={() => setOutputPreference("5g")}
                />
                {t("tools.projectPlanner.outputSet5g")}
              </label>
            </div>
          </fieldset>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.requirements")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {REQUIREMENTS.map((requirement) => (
              <label
                key={requirement}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
              >
                <input
                  type="checkbox"
                  checked={requirements.includes(requirement)}
                  onChange={() => toggleRequirement(requirement)}
                />
                {t(`tools.projectPlanner.requirement.${requirement}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/60">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">{t("tools.projectPlanner.cabinetPixels")}</p>
          <p className="mt-1 tabular-nums text-zinc-600 dark:text-zinc-400">
            {t("tools.projectPlanner.cabinetPixelsValue", {
              w: nf0.format(cabinetPixels.width),
              h: nf0.format(cabinetPixels.height),
              pixels: nf0.format(cabinetPixels.pixels),
            })}
          </p>
          <p className="mt-1 tabular-nums text-zinc-600 dark:text-zinc-400">
            {t("tools.projectPlanner.cabinetGridValue", {
              across: nf0.format(cabinetGrid.across),
              tall: nf0.format(cabinetGrid.tall),
              total: nf0.format(cabinetGrid.total),
            })}
          </p>
        </div>
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.projectPlanner.resultTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {t("tools.projectPlanner.resultSummary", {
            w: nf0.format(screenW),
            h: nf0.format(screenH),
            fps: nf1.format(fps),
            bpc: nf0.format(rgbBpc),
            mbps: nf1.format(requiredMbps),
          })}
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={t("tools.projectPlanner.metricPixels")} value={nf0.format(totalPixels)} note={t("tools.projectPlanner.metricPixelsNote")} />
          <Metric label={t("tools.projectPlanner.metricBandwidth")} value={`${nf2.format(requiredMbps / 1000)} Gbit/s`} note={t("tools.projectPlanner.metricBandwidthNote")} />
          <Metric label={t("tools.projectPlanner.metricPorts")} value={`${nf0.format(ports1g)} / ${nf0.format(ports5g)}`} note={t("tools.projectPlanner.metricPortsNote")} />
          <Metric
            label={t("tools.projectPlanner.metricCabinets")}
            value={nf0.format(cabinetGrid.total)}
            note={t("tools.projectPlanner.metricCabinetsNote", {
              across: nf0.format(cabinetGrid.across),
              tall: nf0.format(cabinetGrid.tall),
            })}
          />
        </dl>

        {best ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t("tools.projectPlanner.bestProcessor")}</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{best.processor.name}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{best.processor.overview}</p>
              {best.inputBoard || best.outputBoard ? (
                <div className="mt-3 space-y-1">
                  {best.inputBoard ? (
                    <BoardLine
                      label={inputBoardLabel}
                      name={best.inputBoard.name}
                      model={best.inputBoard.model}
                      quantity={best.inputBoard.quantity}
                      maxBoards={best.inputBoard.maxBoards}
                      withinLimit={best.inputBoard.withinLimit}
                    />
                  ) : null}
                  {best.outputBoard ? (
                    <BoardLine
                      label={outputBoardLabel}
                      name={best.outputBoard.name}
                      model={best.outputBoard.model}
                      quantity={best.outputBoard.quantity}
                      maxBoards={best.outputBoard.maxBoards}
                      withinLimit={best.outputBoard.withinLimit}
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-1">
                <CapabilityChip state={best.processorSupport.exact ? "ok" : "bad"}>
                  {best.processorOutput
                    ? t("tools.projectPlanner.processorOutput", {
                        mode: modeLabel(t, best.processorOutput.mode),
                        ports: nf0.format(best.processorOutput.ports),
                        capacity: nf0.format(best.processorOutput.capacityPixels),
                      })
                    : t("tools.projectPlanner.noProcessorOutput")}
                </CapabilityChip>
                <CapabilityChip state={best.processor.maxFrameRateHz === null || best.processor.maxFrameRateHz >= fps ? "ok" : "bad"}>
                  {t("tools.projectPlanner.fpsBadge", { fps: nf1.format(best.processor.maxFrameRateHz ?? fps) })}
                </CapabilityChip>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t("tools.projectPlanner.bestReceiver")}</p>
              <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{best.card.name}</h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t("tools.projectPlanner.selectedCardLine", {
                  series: best.card.series,
                  capacity: best.card.maxCapacityLabel,
                  pixels: nf0.format(best.card.maxCapacityPixels),
                })}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                <CapabilityChip state={best.support.depthOk ? "ok" : best.support.depthKnown ? "bad" : "unknown"}>
                  {best.support.depthKnown
                    ? t("tools.projectPlanner.depthBadge", { bpc: nf0.format(best.card.maxColorDepthBpc ?? 0) })
                    : t("tools.projectPlanner.depthUnknown")}
                </CapabilityChip>
                <CapabilityChip state={best.support.frameOk ? "ok" : best.support.frameKnown ? "bad" : "unknown"}>
                  {best.support.frameKnown
                    ? t("tools.projectPlanner.fpsBadge", { fps: nf1.format(best.card.maxFrameRateHz ?? 0) })
                    : t("tools.projectPlanner.fpsUnknown")}
                </CapabilityChip>
                <CapabilityChip state="ok">{modeLabel(t, best.card.portSpeed)}</CapabilityChip>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel-surface rounded-xl p-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{t("tools.projectPlanner.recommendationsTitle")}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {hasExactRecommendations ? t("tools.projectPlanner.recommendationsSubtitle") : t("tools.projectPlanner.noExactRecommendations")}
        </p>

        <div className="mt-4 grid gap-3">
          {recommendationRows.slice(0, 4).map((row, index) => (
            <article
              key={`${row.processor.name}-${row.card.name}-${row.processorOutput?.mode ?? "none"}`}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {index === 0 ? plannerText("tools.projectPlanner.recommendedChoice") : plannerText("tools.projectPlanner.optionLabel", { rank: nf0.format(index + 1) })}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {row.processor.name} + {row.card.name}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {row.exact ? plannerText("tools.projectPlanner.exactReason") : plannerText("tools.projectPlanner.reviewReason")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1 lg:justify-end">
                  <CapabilityChip state={row.exact ? "ok" : row.processorSupport.outputOk ? "unknown" : "bad"}>
                    {row.exact ? t("tools.projectPlanner.fitExact") : row.processorSupport.outputOk ? t("tools.projectPlanner.fitReview") : t("tools.projectPlanner.fitNoOutput")}
                  </CapabilityChip>
                  <CapabilityChip state={row.support.depthOk ? "ok" : row.support.depthKnown ? "bad" : "unknown"}>
                    {row.support.depthKnown
                      ? t("tools.projectPlanner.depthBadge", { bpc: nf0.format(row.card.maxColorDepthBpc ?? 0) })
                      : t("tools.projectPlanner.depthUnknown")}
                  </CapabilityChip>
                  <CapabilityChip state={row.support.frameOk ? "ok" : row.support.frameKnown ? "bad" : "unknown"}>
                    {row.support.frameKnown
                      ? t("tools.projectPlanner.fpsBadge", { fps: nf1.format(row.card.maxFrameRateHz ?? 0) })
                      : t("tools.projectPlanner.fpsUnknown")}
                  </CapabilityChip>
                </div>
              </div>

              <dl className="mt-4 grid gap-4 lg:grid-cols-4">
                <LessonLine label={plannerText("tools.projectPlanner.guideWhy")}>
                  {row.processorOutput
                    ? plannerText("tools.projectPlanner.outputCapacityLine", {
                        output: row.processorOutput.label,
                        required: nf0.format(row.requiredPorts),
                        available: nf0.format(row.processorOutput.ports),
                        capacity: nf0.format(row.processorOutput.capacityPixels),
                      })
                    : t("tools.projectPlanner.noProcessorOutput")}
                </LessonLine>
                <LessonLine label={plannerText("tools.projectPlanner.guideInstall")}>
                  {plannerText("tools.projectPlanner.cardsInstallLine", {
                    cards: nf0.format(row.installedCards),
                    perCabinet: nf0.format(row.perCabinet),
                    minimum: nf0.format(row.pixelMinimum),
                  })}
                </LessonLine>
                <LessonLine label={plannerText("tools.projectPlanner.guideSignal")}>
                  {plannerText("tools.projectPlanner.bandwidthLine", {
                    gbps: nf2.format(requiredMbps / 1000),
                    mode: modeLabel(t, row.outputMode),
                  })}
                </LessonLine>
                <LessonLine label={plannerText("tools.projectPlanner.guideVerify")}>
                  {row.exact
                    ? plannerText("tools.projectPlanner.verifyCards")
                    : plannerText("tools.projectPlanner.verifyReview", { misses: nf0.format(row.requirementMisses) })}
                </LessonLine>
              </dl>

              <div className="mt-4 space-y-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                {row.inputBoard ? (
                  <BoardLine
                    label={inputBoardLabel}
                    name={row.inputBoard.name}
                    model={row.inputBoard.model}
                    quantity={row.inputBoard.quantity}
                    maxBoards={row.inputBoard.maxBoards}
                    withinLimit={row.inputBoard.withinLimit}
                  />
                ) : null}
                {row.outputBoard ? (
                  <BoardLine
                    label={outputBoardLabel}
                    name={row.outputBoard.name}
                    model={row.outputBoard.model}
                    quantity={row.outputBoard.quantity}
                    maxBoards={row.outputBoard.maxBoards}
                    withinLimit={row.outputBoard.withinLimit}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
