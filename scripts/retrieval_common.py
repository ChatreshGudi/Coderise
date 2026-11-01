"""Shared source preparation and pinned retrieval configuration."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = json.loads((ROOT / "config/retrieval.json").read_text())
DATASET = "open-r1/codeforces"
DATASET_REVISION = "fbe3f6e903ee854eec2e69e9d96d0306cde59baf"
SOURCE_URL = "https://huggingface.co/datasets/" + DATASET


def text_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class EditorialText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.hidden += 1
        if tag in ("p", "div", "br", "li", "pre", "h1", "h2", "h3", "h4"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("p", "div", "li", "pre"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def editorial_text(value):
    text = (value or "").strip()
    # Leave Markdown and LaTeX alone. Only parse clear HTML block markup.
    if re.search(r"</?(?:p|div|pre|script|style|h[1-6]|span)(?:\s|>)", text, re.I):
        parser = EditorialText()
        parser.feed(text)
        text = "".join(parser.parts)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def editorial_status(text):
    if len(text) < 80:
        return "needs_review", "short_or_empty_explanation"
    if re.fullmatch(r"\s*(?:https?://\S+\s*)+", text):
        return "needs_review", "link_only"
    if not any(char.isalpha() for char in text):
        return "needs_review", "no_explanatory_text"
    return "ready", ""


def source_key(value):
    try:
        contest, index = str(value).split("/", 1)
        return int(contest), index
    except (ValueError, TypeError):
        return None


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)
