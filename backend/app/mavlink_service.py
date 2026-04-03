"""
JATAYU GCS — MAVLink Service
Handles the connection to the ArduPlane SITL/hardware.
"""
import logging
import threading
import time
from pymavlink import mavutil

log = logging.getLogger("gcs.mavlink")

# ArduPlane specific mode mappings
ARDUPLANE_MODES = {
    "MANUAL": 0,
    "CIRCLE": 1,
    "STABILIZE": 2,
    "TRAINING": 3,
    "ACRO": 4,
    "FLY_BY_WIRE_A": 5,
    "FLY_BY_WIRE_B": 6,
    "CRUISE": 7,
    "AUTOTUNE": 8,
    "AUTO": 10,
    "RTL": 11,
    "LOITER": 12,
    "TAKEOFF": 13,
    "AVOID_ADSB": 14,
    "GUIDED": 15,
    "INITIALISING": 16,
    "QSTABILIZE": 17,
    "QHOVER": 18,
    "QLOITER": 19,
    "QLAND": 20,
    "QRTL": 21
}

class MavlinkService:
    def __init__(self, connection_string="tcp:127.0.0.1:5760"):
        self.connection_string = connection_string
        self.master = None
        self._running = False
        self._thread = None
        self.is_connected = False
        
    def start(self):
        """Starts the background thread to maintain the MAVLink connection."""
        log.info(f"Starting MAVLink service on {self.connection_string}")
        self._running = True
        self._thread = threading.Thread(target=self._connection_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Stops the background thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
            
    def _connection_loop(self):
        """Maintains the connection and listens for heartbeats."""
        while self._running:
            try:
                if not self.master:
                    log.info(f"Attempting to connect to MAVLink at {self.connection_string}...")
                    self.master = mavutil.mavlink_connection(self.connection_string)
                    log.info("MAVLink TCP Socket Established.")
                    self.is_connected = True
                
                # Proactively send a heartbeat to Mission Planner to keep the proxy channel open
                self.master.mav.heartbeat_send(
                    mavutil.mavlink.MAV_TYPE_GCS,
                    mavutil.mavlink.MAV_AUTOPILOT_INVALID,
                    0, 0, 0
                )
                
                # Consume messages to prevent buffer fill, but don't strictly require heartbeats
                # because Mission Planner's TCP proxy is notoriously silent.
                self.master.recv_match(blocking=False)
                
                time.sleep(1.0)
                
            except Exception as e:
                log.error(f"MAVLink connection error: {e}")
                self.is_connected = False
                self.master = None
                time.sleep(2)
                
    def set_mode(self, mode_name: str) -> bool:
        """Sends a set mode command to ArduPlane via MAVLink."""
        if not self.master or not self.is_connected:
            log.error("Cannot set mode: MAVLink not connected.")
            return False
            
        mode_id = ARDUPLANE_MODES.get(mode_name.upper())
        if mode_id is None:
            log.error(f"Unknown mode for ArduPlane: {mode_name}")
            return False
            
        try:
            # MAV_CMD_DO_SET_MODE is command 176
            self.master.mav.command_long_send(
                self.master.target_system,
                self.master.target_component,
                mavutil.mavlink.MAV_CMD_DO_SET_MODE,
                0, # confirmation
                1, # param1: base_mode (1 = custom mode)
                mode_id, # param2: custom_mode
                0, 0, 0, 0, 0 # params 3-7 unused
            )
            log.info(f"Sent MAVLink command to change mode to {mode_name.upper()} ({mode_id})")
            return True
        except Exception as e:
            log.error(f"Failed to send mode command: {e}")
            return False

    def set_altitude(self, altitude_m: float) -> bool:
        """Sends an altitude change command to ArduPlane."""
        if not self.master or not self.is_connected:
            log.error("Cannot set altitude: MAVLink not connected.")
            return False
            
        try:
            # 1. Try modern MAV_CMD_DO_CHANGE_ALTITUDE
            self.master.mav.command_long_send(
                self.master.target_system,
                self.master.target_component,
                mavutil.mavlink.MAV_CMD_DO_CHANGE_ALTITUDE,
                0, # confirmation
                altitude_m, # param 1: Altitude in meters
                mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT, # param 2: Frame (Relative to home)
                0, 0, 0, 0, 0 # params 3-7 unused
            )
            log.info(f"Sent MAVLink command to change target altitude to {altitude_m}m")
            return True
        except Exception as e:
            log.error(f"Failed to send altitude command: {e}")
            return False


# Global singleton instance (using TCP per user request)
mav_service = MavlinkService("tcp:127.0.0.1:5762")
