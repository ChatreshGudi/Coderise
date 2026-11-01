"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export function TopicFilter({ topics, selected }: { topics: string[]; selected: string[] }) {
  const [values, setValues] = useState(selected);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function toggle(topic: string) {
    setValues(current => current.includes(topic) ? current.filter(t => t !== topic) : [...current, topic]);
  }
  return <>
    {values.map(topic => <input key={topic} type="hidden" name="tag" value={topic} />)}
    <div className="filter-control topic-filter">
      <span id="topics-label" className="filter-label">Topics</span>
      <details ref={menu} className="topic-picker" onKeyDown={event => {
        if (event.key === "Escape") {
          event.preventDefault();
          menu.current!.open = false;
          menu.current!.querySelector("summary")?.focus();
        }
      }}>
        <summary className="styled-select-trigger" aria-labelledby="topics-label topics-value">
          <span id="topics-value">{values.length ? `${values.length} topic${values.length === 1 ? "" : "s"} selected` : "All topics"}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="topic-picker-menu" role="group" aria-label="Choose topics">
          <p className="topic-picker-hint">Match all selected topics</p>
          {topics.map(topic => <label className="topic-choice" key={topic}>
            <input type="checkbox" checked={values.includes(topic)} onChange={() => toggle(topic)} />
            <span>{topic}</span>
          </label>)}
        </div>
      </details>
    </div>
    {values.length > 0 && <div className="selected-topic-chips" aria-label="Selected topics">
      {values.map(topic => <button key={topic} type="button" className="topic-chip" aria-label={`Remove topic ${topic}`} onClick={() => toggle(topic)}>{topic}<X size={12} aria-hidden="true" /></button>)}
      <button type="button" className="text-button mono" onClick={() => setValues([])}>Clear topics</button>
      <span className="small muted">Matches all selected topics · Apply filters to update</span>
    </div>}
  </>;
}
