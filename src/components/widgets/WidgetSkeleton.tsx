import type { WidgetDefinition } from "../../types";

const BAR_HEIGHTS = ["58%", "86%", "42%", "70%", "34%", "52%"];

function hasMeter(widget: WidgetDefinition) {
  if (widget.type === "kpi") return Boolean(widget.targetColumn);
  if (widget.type === "date") {
    return widget.dateMode === "yearRemaining" || widget.dateMode === "quarterRemaining";
  }
  return false;
}

export default function WidgetSkeleton({ widget }: { readonly widget: WidgetDefinition }) {
  if (widget.type === "kpi" || widget.type === "date") {
    return (
      <div className="kpi-wrapper" aria-busy="true" aria-label={`Memuat ${widget.title}`}>
        <div className="kpi-label">{widget.title}</div>
        <span className="sk sk-value" />
        {hasMeter(widget) && (
          <>
            <span className="sk sk-meter" />
            <span className="sk sk-caption" />
          </>
        )}
      </div>
    );
  }

  if (widget.type === "table") {
    const rows = Math.min(widget.limit ?? 25, 6);
    return (
      <div className="chart-wrapper" aria-busy="true" aria-label={`Memuat ${widget.title}`}>
        <h4 className="widget-title">{widget.title}</h4>
        <div className="sk-table">
          <span className="sk sk-row sk-row-head" />
          {Array.from({ length: rows }, (_, i) => (
            <span key={i} className="sk sk-row" />
          ))}
        </div>
      </div>
    );
  }

  if (widget.type === "pie") {
    return (
      <div className="chart-wrapper" aria-busy="true" aria-label={`Memuat ${widget.title}`}>
        <h4 className="widget-title">{widget.title}</h4>
        <div className="chart-body sk-donut-body">
          <span className="sk sk-donut" />
          <span className="sk sk-legend" />
        </div>
      </div>
    );
  }

  return (
    <div className="chart-wrapper" aria-busy="true" aria-label={`Memuat ${widget.title}`}>
      <h4 className="widget-title">{widget.title}</h4>
      <div className="chart-body sk-chart">
        <div className="sk-axis">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="sk sk-tick" />
          ))}
        </div>
        <div className="sk-plot">
          {BAR_HEIGHTS.map((height, i) => (
            <span key={i} className="sk sk-bar" style={{ height }} />
          ))}
        </div>
      </div>
    </div>
  );
}
