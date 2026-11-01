import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageNumbers, withParams } from "@/lib/validation";

import { NumberField } from "./number-field";

type Filters = Record<string, string | string[] | number | null | undefined>;
export function Pagination({ page, totalPages, filters }: { page: number; totalPages: number; filters: Filters }) {
  const link = (target: number) => withParams("/problems", { ...filters, page: target });
  const pages = pageNumbers(page, totalPages);
  return <div className="pagination-controls">
    <nav className="pagination-links" aria-label="Problem pages">
      {page > 1 ? <Link className="button secondary" href={link(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /><span>Previous</span></Link> : <span className="button disabled" aria-disabled="true"><ChevronLeft size={14} /><span>Previous</span></span>}
      <span className="mobile-page mono">Page {page} of {totalPages}</span>
      <span className="page-links">{pages.map((target, index) => <span className="page-link-item" key={target}>
        {index > 0 && target > pages[index - 1] + 1 && <span className="page-gap" aria-hidden="true">…</span>}
        {target === page ? <span className="page-number mono" aria-current="page" aria-label={`Page ${target}`}><span aria-hidden="true">[</span>{target}<span aria-hidden="true">]</span></span> : <Link className="page-number mono" href={link(target)} aria-label={`Page ${target}`}>{target}</Link>}
      </span>)}</span>
      {page < totalPages ? <Link className="button secondary" href={link(page + 1)} aria-label="Next page"><span>Next</span><ChevronRight size={14} /></Link> : <span className="button disabled" aria-disabled="true"><span>Next</span><ChevronRight size={14} /></span>}
    </nav>
    {totalPages > 1 && <form className="page-jump" action="/problems">
      {Object.entries(filters).flatMap(([name, value]) => (Array.isArray(value) ? value : [value]).filter(v => v != null && v !== "").map((v, i) => <input key={`${name}-${i}`} type="hidden" name={name} value={String(v)} />))}
      <label htmlFor="jump-page">Go to page</label><NumberField id="jump-page" name="page" label="page" required min={1} max={totalPages} defaultValue={page} key={page} /><button className="button secondary" type="submit">Go</button>
    </form>}
  </div>;
}
