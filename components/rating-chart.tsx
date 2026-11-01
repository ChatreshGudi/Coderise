"use client";

import { useState } from "react";
import { number } from "@/lib/validation";

type Rating = { new_rating: number; name: string; date: string | null };
export function InteractiveRatingChart({ rows }: { rows: Rating[] }) {
  const [active, setActive] = useState<number | null>(null);
  const low = Math.min(...rows.map(row => row.new_rating)) - 50;
  const high = Math.max(...rows.map(row => row.new_rating)) + 50;
  const point = (index: number) => ({ x: index / (rows.length - 1) * 640, y: 150 - (rows[index].new_rating - low) / (high - low) * 130 });
  const selected = rows[active ?? rows.length - 1];
  const selectedPoint = active === null ? null : point(active);
  return <div className="rating-chart">
    <div className="chart-caption mono"><span>{number(high - 50)} HIGH</span><span>{rows.length} RATED CONTESTS</span></div>
      <div className="rating-readout" role="status">
        <strong className="mono">{number(selected.new_rating)} RATING</strong>
        <span>{selected.name}</span>
        {selected.date && <span className="mono muted">{new Date(selected.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span>}
      </div>
    <div className="rating-plot">
      <svg viewBox="0 0 640 180" preserveAspectRatio="none" role="group" tabIndex={0}
        aria-label={`Rating history across ${rows.length} contests. Latest rating ${rows.at(-1)?.new_rating}. Use left and right arrows to explore contests.`}
        onPointerMove={event => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setActive(Math.max(0, Math.min(rows.length - 1, Math.round((event.clientX - bounds.left) / bounds.width * (rows.length - 1)))));
        }}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(rows.length - 1)} onBlur={() => setActive(null)}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          setActive(current => event.key === "Home" ? 0 : event.key === "End" ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, (current ?? rows.length - 1) + (event.key === "ArrowLeft" ? -1 : 1))));
        }}>
        <line x1="0" y1="150" x2="640" y2="150" stroke="var(--line)" />
        <line x1="0" y1="85" x2="640" y2="85" stroke="var(--line)" strokeDasharray="3 5" />
        <polyline points={rows.map((_, i) => `${point(i).x},${point(i).y}`).join(" ")} fill="none" stroke="var(--ink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {selectedPoint && <g className="rating-highlight"><line x1={selectedPoint.x} y1="0" x2={selectedPoint.x} y2="150" stroke="var(--red)" strokeDasharray="3 4" /><circle cx={selectedPoint.x} cy={selectedPoint.y} r="4" fill="var(--red)" stroke="var(--canvas)" strokeWidth="2" vectorEffect="non-scaling-stroke" /></g>}
      </svg>

    </div>
    <div className="chart-caption mono"><span>FIRST IMPORTED CONTEST</span><span>LATEST</span></div>
  </div>;
}
