import unittest
from fastapi.testclient import TestClient
from app.main import app

class TestTwilioIntegration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_whatsapp_webhook_triage(self):
        # Send a sample symptom to WhatsApp Webhook
        response = self.client.post(
            "/api/triage/whatsapp/webhook",
            data={
                "Body": "I have severe stomach pain and nausea since morning",
                "From": "whatsapp:+919999999999"
            }
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/xml", response.headers["content-type"])
        # Verify it contains TwiML Response and Message tag
        self.assertIn("<Response>", response.text)
        self.assertIn("<Message>", response.text)
        print("=== Test WhatsApp Triage XML ===")
        print(response.text[:300])

    def test_voice_webhook_ivr(self):
        response = self.client.post("/api/triage/voice/webhook")
        self.assertEqual(response.status_code, 200)
        self.assertIn("<Gather", response.text)
        self.assertIn("Press 1 to speak your current symptoms", response.text)

    def test_voice_gather_triage(self):
        response = self.client.post("/api/triage/voice/gather", data={"Digits": "1"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("<Record", response.text)

    def test_voice_gather_iot(self):
        response = self.client.post("/api/triage/voice/gather", data={"Digits": "2"})
        self.assertEqual(response.status_code, 200)
        self.assertIn("smart pill dispenser", response.text)

if __name__ == "__main__":
    unittest.main()
