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
    "STABILIZE": 0,
    "ACRO": 1,
    "ALT_HOLD": 2,
    "AUTO": 3,
    "GUIDED": 4,
    "LOITER": 5,
    "RTL": 6,
    "CIRCLE": 7,
    "LAND": 9,
    "DRIFT": 11,
    "SPORT": 13,
    "FLIP": 14,
    "AUTOTUNE": 15,
    "POSHOLD": 16,
    "BRAKE": 17,
    "THROW": 18,
    "AVOID_ADSB": 19,
    "GUIDED_NOGPS": 20,
    "SMART_RTL": 21,
    "FLOWHOLD": 22,
    "FOLLOW": 23,
    "ZIGZAG": 24,
    "SYSTEMID": 25,
    "AUTOROTATE": 26,
    "AUTO_RTL": 27,
    "TURTLE": 28,
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

    def cmd_set_servo_11_max(self) -> bool:
        """Send MAV_CMD_DO_SET_SERVO for SERVO11 at 2000 PWM and wait for ACK."""
        if not self.master or not self.is_connected:
            log.error("ABORT: No MAVLink link.")
            return False

        try:
            log.info("SEND: MAV_CMD_DO_SET_SERVO (11 -> 2000)")
            self.master.mav.command_long_send(
                self.master.target_system,
                self.master.target_component,
                mavutil.mavlink.MAV_CMD_DO_SET_SERVO,
                0,
                11,     # servo instance
                2000,   # pwm
                0, 0, 0, 0, 0
            )
            
            # Wait for ACK confirmation
            start_wait = time.time()
            while time.time() - start_wait < 3.0:
                ack = self.master.recv_match(type='COMMAND_ACK', blocking=False)
                if ack and ack.command == mavutil.mavlink.MAV_CMD_DO_SET_SERVO:
                    if ack.result == mavutil.mavlink.MAV_RESULT_ACCEPTED:
                        log.info("ACK RECEIVED: Payload delivery confirmed (ACCEPTED)")
                        return True
                    else:
                        log.error(f"ACK REJECTED: Delivery failed with result code {ack.result}")
                        return False
                time.sleep(0.05)
                
            log.warning("ACK TIMEOUT: No delivery confirmation received from ArduPilot")
            return False
            
        except Exception as e:
            log.error(f"SERVO ERROR: {e}")
            return False


# Global singleton instance (using TCP per user request)
mav_service = MavlinkService("tcp:127.0.0.1:5762")
