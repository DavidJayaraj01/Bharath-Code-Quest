import httpx
from app.core.config import get_settings

class TwilioResult:
    def __init__(self, success: bool, error_code: int = None, error_message: str = None):
        self.success = success
        self.error_code = error_code
        self.error_message = error_message

    def __bool__(self):
        return self.success

def send_twilio_message(to_phone: str, body: str, is_whatsapp: bool = True) -> TwilioResult:
    settings = get_settings()
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print("[Twilio] Credentials not configured. Skipping message send.")
        return TwilioResult(False, error_message="Credentials not configured")

    to_addr = to_phone
    
    if is_whatsapp:
        from_addr = settings.TWILIO_WHATSAPP_FROM
        if not to_addr.startswith("whatsapp:"):
            to_addr = f"whatsapp:{to_addr}"
        if not from_addr.startswith("whatsapp:"):
            from_addr = f"whatsapp:{from_addr}"
    else:
        from_addr = settings.TWILIO_SMS_FROM or settings.TWILIO_WHATSAPP_FROM.replace("whatsapp:", "")
        to_addr = to_addr.replace("whatsapp:", "")
        if from_addr:
            from_addr = from_addr.replace("whatsapp:", "")

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    data = {
        "To": to_addr,
        "From": from_addr,
        "Body": body
    }

    try:
        response = httpx.post(url, auth=auth, data=data)
        if response.status_code in [200, 201]:
            print(f"[Twilio] Message successfully sent to {to_addr}.")
            return TwilioResult(True)
        else:
            err_data = {}
            try:
                err_data = response.json()
            except Exception:
                pass
            error_code = err_data.get("code")
            error_message = err_data.get("message")
            print(f"[Twilio] Failed to send message. Status: {response.status_code}. Code: {error_code}. Message: {error_message}")
            return TwilioResult(False, error_code=error_code, error_message=error_message)
    except Exception as e:
        print(f"[Twilio] Exception occurred sending message: {e}")
        return TwilioResult(False, error_message=str(e))
