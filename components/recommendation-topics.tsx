"use client";

import { useState, type ReactNode } from "react";

export function RecommendationTopics({ children }: { children: ReactNode }) {
  const [show, setShow] = useState(false);
  return <section className="recommendation-results" data-show-topics={show} aria-label="Recommended problems">
    <div className="recommendation-toolbar"><label className="checkbox-label"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)} aria-controls="recommended-problems" />Show topics</label></div>
    <div id="recommended-problems" className="recommendation-list">{children}</div>
  </section>;
}
