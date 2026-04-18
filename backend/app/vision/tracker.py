"""
JATAYU GCS — Lightweight Posture Tracker
Centroid-distance based target association + temporal smoothing.

This is NOT a full multi-object tracker — it only exists to stabilise
per-target posture labels across a short sliding window of frames.
"""
from __future__ import annotations
import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class TrackState:
    """Internal state for a single tracked target."""
    cx: float = 0.0
    cy: float = 0.0
    history: deque = field(default_factory=lambda: deque(maxlen=7))
    last_seen: float = 0.0


class PostureTracker:
    """
    Maintains a short posture history per detection and returns a
    temporally-smoothed posture via majority vote.

    Parameters
    ----------
    max_history : int
        Number of recent posture labels to keep per track.
    match_distance : float
        Maximum pixel distance to associate a new detection with an
        existing track (only used as fallback when YOLO track ID is missing).
    ttl : float
        Seconds after which a track is expired if not updated.
    """

    def __init__(
        self,
        max_history: int = 7,
        match_distance: float = 80.0,
        ttl: float = 3.0,
    ):
        self.max_history = max_history
        self.match_distance = match_distance
        self.ttl = ttl
        self._tracks: dict[str, TrackState] = {}

    # ── Public API ───────────────────────────────────────────────────────

    def update(
        self,
        track_id: str,
        cx: float,
        cy: float,
        posture: str,
    ) -> str:
        """
        Register a new observation for *track_id* and return the
        temporally-smoothed posture.

        If *track_id* already exists the centroid is updated.
        If not, a new track is created.
        """
        now = time.monotonic()

        if track_id in self._tracks:
            trk = self._tracks[track_id]
        else:
            trk = TrackState(
                history=deque(maxlen=self.max_history),
            )
            self._tracks[track_id] = trk

        trk.cx = cx
        trk.cy = cy
        trk.last_seen = now
        trk.history.append(posture)

        return self._smooth(trk.history)

    def expire_stale(self) -> int:
        """Remove tracks not updated within *ttl* seconds.  Returns count removed."""
        now = time.monotonic()
        stale = [
            tid for tid, trk in self._tracks.items()
            if (now - trk.last_seen) > self.ttl
        ]
        for tid in stale:
            del self._tracks[tid]
        return len(stale)

    @property
    def active_track_count(self) -> int:
        return len(self._tracks)

    # ── Internal ─────────────────────────────────────────────────────────

    @staticmethod
    def _smooth(history: deque) -> str:
        """
        Majority-vote smoothing over the posture history.

        Tie-breaking priority:  prone > unknown > upright
        (biasing toward the more urgent rescue signal).
        """
        if not history:
            return "unknown"

        counts: dict[str, int] = {}
        for label in history:
            counts[label] = counts.get(label, 0) + 1

        max_count = max(counts.values())
        winners = [lbl for lbl, cnt in counts.items() if cnt == max_count]

        if len(winners) == 1:
            return winners[0]

        # Tie-break: prone > unknown > upright
        for priority in ("prone", "unknown", "upright"):
            if priority in winners:
                return priority

        return "unknown"
