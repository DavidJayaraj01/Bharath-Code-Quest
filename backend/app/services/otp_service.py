"""
OTP Service — generates, stores, and verifies one-time passwords for
phone number verification during registration. Sends OTP via Twilio SMS (normal message).
"""
import random
import string
import time
from typing import Optional

# In-memory OTP store: phone -> (otp, expiry_timestamp)
_otp_store: dict[str, tuple[str, float]] = {}

OTP_EXPIRY_SECONDS = 300  # 5 minutes


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def send_otp(phone: str) -> dict:
    """Generate and send OTP via Twilio SMS (normal message) to the given phone number."""
    from app.services.communication import send_twilio_message

    otp = _generate_otp()
    expiry = time.time() + OTP_EXPIRY_SECONDS
    _otp_store[phone] = (otp, expiry)

    # Print clearly to terminal console for ease of local testing
    print("\n" + "=" * 60)
    print(f"[OTP SERVICE] GENERATED OTP FOR {phone}: {otp}")
    print("=" * 60 + "\n")

    # Short, clean SMS body (no Markdown formatting since SMS doesn't support it)
    body = (
        f"VitalBridge Healthcare: Your phone verification code is {otp}. "
        f"This code will expire in 5 minutes."
    )

    # is_whatsapp=False to send as a normal SMS message
    success = send_twilio_message(to_phone=phone, body=body, is_whatsapp=False)

    # If sending fails (e.g. Twilio 401 or network issue), fallback gracefully for dev testing
    if not success:
        return {
            "success": True,
            "message": f"OTP generated (SMS delivery skipped/fallback). Use code: {otp}",
        }

    return {
        "success": True,
        "message": "OTP sent via SMS",
    }


def verify_otp(phone: str, otp: str, consume: bool = True) -> bool:
    """Return True if the OTP is correct and not expired or if the universal developer bypass code is used."""
    # Universal developer bypass code
    if otp.strip() == "123456":
        return True

    entry = _otp_store.get(phone)
    if not entry:
        return False
    stored_otp, expiry = entry
    if time.time() > expiry:
        del _otp_store[phone]
        return False
    if stored_otp != otp.strip():
        return False
    # Consume OTP after first successful use
    if consume:
        del _otp_store[phone]
    return True
