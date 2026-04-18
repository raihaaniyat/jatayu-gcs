"""
JATAYU GCS — Geometric Posture Classifier
Classifies detected persons as upright / prone / unknown using only
bounding-box geometry.  Zero neural overhead — pure arithmetic.

Designed for top-down / nadir-facing drone cameras in disaster-response SAR.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class PostureConfig:
    """All tuneable thresholds live here — change without touching logic."""

    # ── Aspect-ratio thresholds ──────────────────────────────────────────
    STRONG_PRONE_RATIO: float = 1.8    # ratio >= this  → strong prone signal
    SOFT_PRONE_RATIO: float = 1.5      # ratio >= this  → soft prone signal
    STRONG_UPRIGHT_RATIO: float = 1.25 # ratio <= this  → strong upright signal
    SOFT_UPRIGHT_RATIO: float = 1.4    # ratio <= this  → soft upright signal

    # ── Area gate (px²) — tiny boxes are noise ───────────────────────────
    MIN_AREA: float = 200.0

    # ── Score → label thresholds ─────────────────────────────────────────
    PRONE_THRESHOLD: int = 2
    UPRIGHT_THRESHOLD: int = -2

    # ── Numerical safety ─────────────────────────────────────────────────
    EPSILON: float = 1e-6

    # ── Severity adjustments ─────────────────────────────────────────────
    PRONE_SEVERITY_BOOST: int = 2      # added to severity when prone
    UPRIGHT_SEVERITY_REDUCE: int = 1   # subtracted from severity when upright


# Module-level default config (shared singleton)
_DEFAULT_CONFIG = PostureConfig()


def classify_posture(
    bbox: list[float],
    config: PostureConfig | None = None,
) -> dict:
    """
    Classify a single person detection's posture from its bounding box.

    Parameters
    ----------
    bbox : [x1, y1, x2, y2]
    config : PostureConfig (uses module default if None)

    Returns
    -------
    dict with keys: posture, aspect_ratio, area, score
    """
    cfg = config or _DEFAULT_CONFIG

    x1, y1, x2, y2 = bbox
    w = abs(x2 - x1)
    h = abs(y2 - y1)
    area = w * h
    ratio = max(w, h) / (min(w, h) + cfg.EPSILON)

    # ── Gate: too-small boxes are unreliable ──────────────────────────────
    if area < cfg.MIN_AREA:
        return {
            "posture": "unknown",
            "aspect_ratio": round(ratio, 3),
            "area": round(area, 1),
            "score": 0,
        }

    # ── Score accumulation ───────────────────────────────────────────────
    score = 0

    # Prone signals (positive score)
    if ratio >= cfg.STRONG_PRONE_RATIO:
        score += 2
    elif ratio >= cfg.SOFT_PRONE_RATIO:
        score += 1

    # Upright signals (negative score)
    if ratio <= cfg.STRONG_UPRIGHT_RATIO:
        score -= 2
    elif ratio <= cfg.SOFT_UPRIGHT_RATIO:
        score -= 1

    # Large elongated boxes get extra prone weight
    if ratio >= cfg.SOFT_PRONE_RATIO and area > cfg.MIN_AREA * 3:
        score += 1

    # ── Label assignment ─────────────────────────────────────────────────
    if score >= cfg.PRONE_THRESHOLD:
        posture = "prone"
    elif score <= cfg.UPRIGHT_THRESHOLD:
        posture = "upright"
    else:
        posture = "unknown"

    return {
        "posture": posture,
        "aspect_ratio": round(ratio, 3),
        "area": round(area, 1),
        "score": score,
    }


def adjust_severity(
    base_severity: int,
    posture: str,
    config: PostureConfig | None = None,
) -> int:
    """Bump or reduce severity based on posture classification."""
    cfg = config or _DEFAULT_CONFIG
    if posture == "prone":
        return min(10, base_severity + cfg.PRONE_SEVERITY_BOOST)
    elif posture == "upright":
        return max(1, base_severity - cfg.UPRIGHT_SEVERITY_REDUCE)
    return base_severity
