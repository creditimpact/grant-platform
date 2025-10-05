"""Shared helpers for running document detection across services."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, Iterator, List, Optional, Sequence, Tuple
import re

from . import DocumentDefinition, DetectorSpec, load_catalog


@dataclass(frozen=True)
class DetectionResult:
    """Result returned when a detector matches a document."""

    key: str
    score: float
    matches: Dict[str, List[str]]
    definition: DocumentDefinition


class DocumentDetectorRegistry:
    """Scores uploaded documents against the shared catalog."""

    def __init__(self, definitions: Optional[Iterable[DocumentDefinition]] = None):
        self._definitions: List[DocumentDefinition] = list(definitions or load_catalog())
        self._index: Dict[str, DocumentDefinition] = {doc.key: doc for doc in self._definitions}

    @classmethod
    def from_catalog(cls) -> "DocumentDetectorRegistry":
        return cls(load_catalog())

    @property
    def definitions(self) -> List[DocumentDefinition]:
        return list(self._definitions)

    def iter_matches(
        self,
        *,
        text: str,
        filename: Optional[str] = None,
        families: Optional[Sequence[str]] = None,
        threshold: float = 0.0,
    ) -> Iterator[DetectionResult]:
        """Yield detection results above a given threshold."""

        normalized_families = None
        if families:
            normalized_families = {family.lower() for family in families}

        filename_lower = filename.lower() if filename else None
        lowered_text = text.lower() if text else ""
        for definition in self._definitions:
            if normalized_families and definition.family.lower() not in normalized_families:
                continue
            result = _score_definition(definition, lowered_text, filename_lower, text)
            if result.score >= threshold:
                yield result

    def best_match(
        self,
        *,
        text: str,
        filename: Optional[str] = None,
        families: Optional[Sequence[str]] = None,
        threshold: float = 0.0,
    ) -> Optional[DetectionResult]:
        """Return the highest scoring detection above the threshold."""

        best: Optional[DetectionResult] = None
        for candidate in self.iter_matches(
            text=text,
            filename=filename,
            families=families,
            threshold=threshold,
        ):
            if not best or candidate.score > best.score:
                best = candidate
        return best

    def get(self, key: str) -> Optional[DocumentDefinition]:
        return self._index.get(key)


def _score_definition(
    definition: DocumentDefinition,
    lowered_text: str,
    lowered_filename: Optional[str],
    original_text: str,
) -> DetectionResult:
    spec: DetectorSpec = definition.detector
    matches: Dict[str, List[str]] = {}
    score = 0.0

    if lowered_filename and spec.filename_contains:
        hits = [term for term in spec.filename_contains if term.lower() in lowered_filename]
        if hits:
            matches["filename_contains"] = hits
            score += 0.3

    if spec.text_contains:
        text_hits = [term for term in spec.text_contains if term.lower() in lowered_text]
        if text_hits:
            matches["text_contains"] = text_hits
            score += 0.5

    if spec.text_regex:
        regex_hits = []
        for pattern in spec.text_regex:
            flags = 0
            if pattern.startswith("(?i)"):
                flags |= re.IGNORECASE
            if re.search(pattern, original_text, flags=flags):
                regex_hits.append(pattern)
        if regex_hits:
            matches["text_regex"] = regex_hits
            score += 0.5

    if score > 0 and spec.score_bonus:
        score += spec.score_bonus

    return DetectionResult(
        key=definition.key,
        score=score,
        matches=matches,
        definition=definition,
    )


def build_identify_map() -> Dict[str, Dict[str, object]]:
    """Produce an identify map compatible with the legacy analyzer API."""

    mapping: Dict[str, Dict[str, object]] = {}
    for document in load_catalog():
        identify: Dict[str, object] = {
            "keywords_any": list(document.detector.text_contains),
            "regex_any": list(document.detector.text_regex),
        }
        if document.detector.score_bonus:
            identify["score_bonus"] = document.detector.score_bonus
        if document.detector.page_hints:
            identify["page_hints"] = list(document.detector.page_hints)
        mapping[document.key] = {
            "identify": identify,
            "definition": document,
        }
    return mapping


__all__ = [
    "DetectionResult",
    "DocumentDetectorRegistry",
    "build_identify_map",
]
