const COLORS = { good: "#10b981", accent: "#4f46e5", bad: "#ef4444", warn: "#f59e0b", neutral: "#8a94a6" } as const;

/** Tiny trend area with an end-point dot. Pure SVG, safe in server components. */
export function Sparkline({ data, tone = "good", width = 96, height = 40 }: { data: number[]; tone?: keyof typeof COLORS; width?: number; height?: number }) {
  const c = COLORS[tone];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const flat = max - min < 1e-9;
  const span = max - min || 1;
  const pad = 4;
  const pts = data.map((v, i) => [pad + (i / (data.length - 1)) * (width - pad * 2), flat ? height * 0.42 : pad + (1 - (v - min) / span) * (height - pad * 2)] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const id = `sp-${tone}-${data.length}-${Math.round(max)}`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity={flat ? 0.18 : 0.32} />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.33, 0.66].map((f) => (
        <line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke="#e2e5ef" strokeDasharray="3 3" />
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={c} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={c} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}
