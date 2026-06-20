import unittest
import httpx
from app.core.config import get_settings

class TestTwilioCredentials(unittest.TestCase):
    def test_verify_keys(self):
        settings = get_settings()
        self.assertIsNotNone(settings.TWILIO_ACCOUNT_SID, "TWILIO_ACCOUNT_SID is not set in .env")
        self.assertIsNotNone(settings.TWILIO_AUTH_TOKEN, "TWILIO_AUTH_TOKEN is not set in .env")
        
        url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}.json"
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        print(f"Verifying Twilio Account SID: {settings.TWILIO_ACCOUNT_SID} ...")
        response = httpx.get(url, auth=auth)
        
        print(f"Twilio API Response Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Account Name: {data.get('friendly_name')}")
            print(f"Account Status: {data.get('status')}")
            print(f"Account Type: {data.get('type')}")
        else:
            print(f"Error Response: {response.text}")
            
        self.assertEqual(response.status_code, 200, "Twilio authentication failed. Check SID and Auth Token.")

if __name__ == "__main__":
    unittest.main()
