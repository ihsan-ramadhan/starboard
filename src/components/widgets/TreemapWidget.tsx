import { useMemo } from "react";
import type { ChartDataPoint, CurrencyCode, ValueFormat } from "../../types";
import { ChartFrame, escapeHtml } from "./chartParts";
import { EChart } from "./EChart";
import { compactValueAs, formatValueAs } from "../../lib/format";
import { useDataLabelsShown } from "../../lib/prefs";
import type { EChartsOption } from "echarts";
import { useLang } from "../../lib/i18n";
import { chartChrome, useResolvedTheme } from "../../lib/theme";

export type TreemapWidgetProps = {
  readonly title: string;
  readonly data: readonly ChartDataPoint[];
  readonly colors: Record<string, string>;
  readonly format?: ValueFormat;
  readonly unit?: string;
  readonly currency?: CurrencyCode;
  readonly reloadNonce?: number;
};

export default function TreemapWidget({
  title,
  data,
  colors,
  format,
  unit,
  currency,
  reloadNonce,
}: TreemapWidgetProps) {
  const lang = useLang();
  const theme = useResolvedTheme();
  const labels = useDataLabelsShown();
  const c = chartChrome(theme);

  const option = useMemo<EChartsOption>(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0);

    return {
      animation: true,
      animationDuration: 600,
      tooltip: {
        trigger: "item",
        appendToBody: true,
        backgroundColor: c.panel,
        borderColor: c.panelBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: c.text, fontSize: 12 },
        extraCssText:
          `box-shadow: 0 4px 6px -1px ${c.shadow}; border-radius: 6px;`,
        formatter: (p: any) => {
          const share = total > 0 ? Math.round((p.value / total) * 100) : 0;
          return (
            `<div style="font-weight:600;margin-bottom:4px">${escapeHtml(p.name)}</div>` +
            `<div style="font-variant-numeric:tabular-nums">${escapeHtml(
              formatValueAs(p.value, format, currency, unit)
            )} (${share}%)</div>`
          );
        },
      },
      series: [
        {
          type: "treemap",
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          width: "100%",
          height: "100%",
          top: 4,
          left: 0,
          right: 0,
          bottom: 4,
          itemStyle: { borderColor: c.panel, borderWidth: 2, gapWidth: 2 },
          label: {
            color: c.panel,
            fontSize: 12,
            fontWeight: 600,
            overflow: "truncate",
            formatter: labels
              ? (p: any) =>
                  `${p.name}\n${compactValueAs(p.value, format, currency, unit)}`
              : undefined,
          },
          data: data.map((d) => ({
            name: d.groupKey,
            value: d.value,
            itemStyle: { color: colors[d.groupKey] },
          })),
        },
      ],
    };
  }, [data, colors, format, unit, currency, lang, theme, labels]);

  return (
    <ChartFrame title={title} isEmpty={data.length === 0}>
      <EChart option={option} reloadNonce={reloadNonce} />
    </ChartFrame>
  );
}
