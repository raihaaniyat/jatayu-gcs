"""
JATAYU GCS — Action Log Routes
Command acknowledgement and operation log
"""
import logging
from datetime import datetime
from fastapi import APIRouter
from app.models import ActionLogEntry

router = APIRouter()
log = logging.getLogger("gcs.actions")

_action_log: list[dict] = []


@router.get("/actions/log", response_model=list[ActionLogEntry])
async def get_action_log():
    """Get recent action log entries."""
    return [ActionLogEntry(**e) for e in _action_log[-100:]]


@router.post("/actions/log", response_model=ActionLogEntry)
async def add_action_log(entry: ActionLogEntry):
    """Add an action log entry."""
    if not entry.id:
        entry.id = f"ACT-{len(_action_log) + 1:04d}"
    if not entry.timestamp:
        entry.timestamp = datetime.now().isoformat()

    _action_log.append(entry.model_dump())
    log.info(f"Action logged: [{entry.status}] {entry.action_type} — {entry.context}")
    return entry
