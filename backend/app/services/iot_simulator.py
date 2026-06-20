"""
IoT Pill Dispenser Simulator — state machine implementation.

State machine: LOCKED -> DOSE_WINDOW_OPEN -> DISPENSED / MISSED -> LOCKED

This module implements the exact event schema a real ESP32 BLE GATT characteristic
would emit. Swapping in real hardware later only means replacing the event *source*.

In demo mode, a "day" is compressed to IOT_DEMO_DAY_SECONDS (default 120s = 2 min).
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Optional

from app.core.config import get_settings
from app.core.ws_manager import manager
from app.db.session import SessionLocal
from app.models.models import DispenserDevice, DispenserEvent

settings = get_settings()

# State machine transitions
VALID_TRANSITIONS = {
    "locked": ["dose_window_open"],
    "dose_window_open": ["dispensed", "missed"],
    "dispensed": ["locked"],
    "missed": ["locked"],
}


class DispenserSimulator:
    """Simulates a smart pill dispenser with compressed demo time."""

    def __init__(self, device_id: str, demo_day_seconds: int = None):
        self.device_id = device_id
        self.demo_day_seconds = demo_day_seconds or settings.IOT_DEMO_DAY_SECONDS
        self._running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Start the simulator loop."""
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self):
        """Stop the simulator."""
        self._running = False
        if self._task:
            self._task.cancel()

    async def _transition(self, device: DispenserDevice, new_state: str, db):
        """Execute a state transition and log the event."""
        old_state = device.state
        if new_state not in VALID_TRANSITIONS.get(old_state, []):
            return

        event = DispenserEvent(
            device_id=device.id,
            event_type="state_change",
            from_state=old_state,
            to_state=new_state,
            payload={
                "medication": device.medication_name,
                "dosage": device.dosage,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "simulated": True,
            },
        )
        device.state = new_state
        db.add(event)
        db.commit()

        # Broadcast to WebSocket subscribers
        await manager.broadcast(f"iot:{device.id}", {
            "type": "dispenser_event",
            "event": {
                "id": event.id,
                "device_id": event.device_id,
                "event_type": event.event_type,
                "from_state": old_state,
                "to_state": new_state,
                "payload": event.payload,
                "created_at": event.created_at.isoformat(),
            },
        })

        # Calculate adherence rate to broadcast to surveillance dashboard
        events_list = db.query(DispenserEvent).filter(DispenserEvent.device_id == device.id).all()
        taken_count = sum(1 for e in events_list if e.event_type == "dose_taken")
        missed_count = sum(1 for e in events_list if e.event_type == "dose_missed" or e.to_state == "missed")
        total_adherence = taken_count + missed_count
        adherence_rate = 100.0
        if total_adherence > 0:
            adherence_rate = round((taken_count / total_adherence) * 100.0, 1)

        await manager.broadcast("surveillance", {
            "type": "dispenser_state_change",
            "device_id": device.id,
            "to_state": new_state,
            "adherence_rate": adherence_rate,
            "last_event_time": event.created_at.isoformat(),
        })

        # If missed dose, create an alert
        if new_state == "missed":
            alert_event = DispenserEvent(
                device_id=device.id,
                event_type="alert",
                from_state="dose_window_open",
                to_state="missed",
                payload={
                    "alert_type": "missed_dose",
                    "medication": device.medication_name,
                    "message": f"Missed dose of {device.medication_name} ({device.dosage})",
                    "simulated": True,
                },
            )
            db.add(alert_event)
            db.commit()

            await manager.broadcast(f"iot:{device.id}", {
                "type": "missed_dose_alert",
                "device_id": device.id,
                "medication": device.medication_name,
                "dosage": device.dosage,
            })

            # Send real WhatsApp notification
            try:
                from app.models.models import Patient, User
                from app.services.communication import send_twilio_message
                patient = db.query(Patient).filter(Patient.id == device.patient_id).first()
                p_user = db.query(User).filter(User.id == patient.user_id).first() if patient else None
                if patient and patient.phone:
                    name = p_user.full_name if p_user else "Patient"
                    msg_body = (
                        f"VITALBRIDGE ALERT: {name} has missed their scheduled dose of {device.medication_name} ({device.dosage}). "
                        f"Please check in on them."
                    )
                    send_twilio_message(to_phone=patient.phone, body=msg_body, is_whatsapp=True)
            except Exception as e:
                print(f"[Twilio Missed Dose Notification Error] {e}")

    async def _run_loop(self):
        """Main simulation loop with compressed time."""
        import random

        # Each cycle: locked -> dose_window_open -> (wait) -> dispensed/missed -> locked
        cycle_duration = self.demo_day_seconds / 2  # 2 doses per "day"

        while self._running:
            db = SessionLocal()
            try:
                device = db.query(DispenserDevice).filter(
                    DispenserDevice.id == self.device_id
                ).first()
                if not device:
                    break

                # Phase 1: LOCKED -> DOSE_WINDOW_OPEN
                await self._transition(device, "dose_window_open", db)
                await asyncio.sleep(cycle_duration * 0.6)  # 60% of cycle is the dose window

                # Phase 2: Patient takes dose (85% chance) or misses
                db.refresh(device)
                if random.random() < 0.85:
                    await self._transition(device, "dispensed", db)
                    dose_event = DispenserEvent(
                        device_id=device.id,
                        event_type="dose_taken",
                        from_state="dose_window_open",
                        to_state="dispensed",
                        payload={
                            "medication": device.medication_name,
                            "dosage": device.dosage,
                            "simulated": True,
                        },
                    )
                    db.add(dose_event)
                    db.commit()
                else:
                    await self._transition(device, "missed", db)

                await asyncio.sleep(cycle_duration * 0.3)

                # Phase 3: Back to LOCKED
                db.refresh(device)
                await self._transition(device, "locked", db)
                await asyncio.sleep(cycle_duration * 0.1)

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[IoT Simulator] Error: {e}")
                await asyncio.sleep(5)
            finally:
                db.close()


# Registry of active simulators
_active_simulators: dict[str, DispenserSimulator] = {}


async def start_simulator(device_id: str):
    """Start a simulator for a specific device."""
    if device_id in _active_simulators:
        return
    sim = DispenserSimulator(device_id)
    _active_simulators[device_id] = sim
    await sim.start()


async def stop_simulator(device_id: str):
    """Stop a simulator for a specific device."""
    sim = _active_simulators.pop(device_id, None)
    if sim:
        await sim.stop()


async def start_all_simulators():
    """Start simulators for all simulated devices in the database."""
    db = SessionLocal()
    try:
        devices = db.query(DispenserDevice).filter(DispenserDevice.is_simulated == True).all()
        for device in devices:
            await start_simulator(device.id)
    finally:
        db.close()
