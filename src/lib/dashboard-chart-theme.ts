import type { CSSProperties } from "react";

/** Recharts styling aligned with app dark panels (#15171e) and readable axes/tooltips. */
export function getDashboardChartChrome(resolvedTheme: string | undefined) {
  const dark = resolvedTheme === "dark";
  return {
    gridStroke: dark ? "rgba(255, 255, 255, 0.1)" : "#e4e4e7",
    axisStroke: dark ? "rgba(255, 255, 255, 0.14)" : "#d4d4d8",
    tickFill: dark ? "#d4d4d8" : "#52525b",
    cursorFill: dark ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.06)",
    pieStroke: dark ? "rgba(255, 255, 255, 0.12)" : "#ffffff",
    tooltipContentStyle: {
      backgroundColor: dark ? "#15171e" : "#ffffff",
      border: dark ? "1px solid rgba(255, 255, 255, 0.12)" : "1px solid #e4e4e7",
      borderRadius: "8px",
      fontSize: "12px",
      color: dark ? "#e8e8ed" : "#18181b",
    } satisfies CSSProperties,
    tooltipLabelStyle: {
      color: dark ? "#fafafa" : "#18181b",
      fontWeight: 600,
    } satisfies CSSProperties,
    tooltipItemStyle: {
      color: dark ? "#e8e8ed" : "#3f3f46",
    } satisfies CSSProperties,
  };
}
