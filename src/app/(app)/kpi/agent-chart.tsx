"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Brand teal first, then distinguishable companions (charcoal, sea-green, amber); lifted for dark backgrounds.
const SERIES = {
  light: ["#01637e", "#4d4e50", "#3f93ac", "#d98c1f"],
  dark: ["#1b9ec2", "#a4aeb9", "#6fc3d8", "#f0a93a"],
};
const AXES = {
  light: { grid: "#e2e8f0", axis: "#cbd5e1", text: "#52514e", tooltipBg: "#ffffff", cursor: "rgba(148,163,184,0.12)" },
  dark: { grid: "#2a343f", axis: "#384350", text: "#a4aeb9", tooltipBg: "#161c23", cursor: "rgba(148,163,184,0.10)" },
};

/** Tracks the .dark class on <html> so SVG colours follow the user's theme. */
function useIsDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

export function AgentChart({ data, series }: { data: Record<string, string | number | null>[]; series: { key: string; label: string }[] }) {
  const mode = useIsDark() ? "dark" : "light";
  const c = AXES[mode];
  if (!data.length || !series.length) return <p className="py-8 text-center text-sm text-slate-400">No agent data for this period.</p>;
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={2} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: c.text }} tickLine={false} axisLine={{ stroke: c.axis }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: c.text }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: c.cursor }} contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: c.grid, background: c.tooltipBg, color: c.text }} />
          <Legend wrapperStyle={{ fontSize: 12, color: c.text }} iconType="circle" />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[mode][i % SERIES[mode].length]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
