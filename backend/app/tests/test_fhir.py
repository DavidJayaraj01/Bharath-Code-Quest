import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.models import User, Patient

class TestFHIRPassport(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Login to obtain patient JWT token
        response = self.client.post(
            "/api/auth/login",
            json={
                "email": "priya.sharma@demo.vitalbridge.in",
                "password": "demo1234"
            }
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_fhir_export_format(self):
        # Fetch patient record in FHIR format
        response = self.client.get("/api/passport/fhir", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify FHIR structure fields
        self.assertEqual(data["resourceType"], "Patient")
        self.assertEqual(data["active"], True)
        self.assertIn("name", data)
        self.assertEqual(data["name"][0]["text"], "Priya Sharma")
        
        # Verify ABHA Identifier
        self.assertIn("identifier", data)
        self.assertEqual(data["identifier"][0]["system"], "https://ndhm.gov.in/abha")
        self.assertEqual(data["identifier"][0]["value"], "12-3456-7890-1234")
        
        print("=== FHIR R4 JSON Export ===")
        import json
        print(json.dumps(data, indent=2))

if __name__ == "__main__":
    unittest.main()
