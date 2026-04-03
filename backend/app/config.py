"""
JATAYU GCS — Backend Configuration
"""
from pydantic import BaseModel, Field
import os


class Settings(BaseModel):
    app_name: str = "JATAYU GCS Backend"
    host: str = "0.0.0.0"
    port: int = 8080

    # Telemetry source (Mission Planner HTTP endpoint)
    telemetry_url: str = "http://127.0.0.1:56781/mavlink/"
    telemetry_timeout: float = 0.5

    # MAVLink command connection
    mavlink_conn: str = Field(default="tcp:127.0.0.1:5760")

    # Recordings directory
    recordings_dir: str = Field(default="recordings")

    # Target database
    db_file: str = Field(default="detected_targets.json")


def get_settings() -> Settings:
    overrides = {}
    prefix = "GCS_"
    for key, value in os.environ.items():
        if key.startswith(prefix):
            overrides[key[len(prefix):].lower()] = value
    return Settings(**overrides)
