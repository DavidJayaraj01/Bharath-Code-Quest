import unittest
import sqlite3
import uuid
from app.db.session import SessionLocal
from app.models.models import Patient, User
from app.core.config import get_settings

class TestEncryption(unittest.TestCase):
    def setUp(self):
        settings = get_settings()
        self.db = SessionLocal()
        # Create a unique email for the test run
        self.test_email = f"test_{uuid.uuid4().hex[:8]}@demo.vitalbridge.in"
        self.user = User(
            email=self.test_email,
            hashed_password="hashedpassword123",
            full_name="PII Test Patient",
            role="patient"
        )
        self.db.add(self.user)
        self.db.flush()

        self.patient = Patient(
            user_id=self.user.id,
            phone="+91-9988776655",
            address="123 Secretariat Road, New Delhi",
            emergency_contact_phone="+91-9999988888"
        )
        self.db.add(self.patient)
        self.db.commit()

    def tearDown(self):
        self.db.delete(self.patient)
        self.db.delete(self.user)
        self.db.commit()
        self.db.close()

    def test_pii_encryption_and_decryption(self):
        # 1. Fetch the patient back via SQLAlchemy (should transparently decrypt)
        patient_ref = self.db.query(Patient).filter(Patient.id == self.patient.id).first()
        self.assertIsNotNone(patient_ref)
        self.assertEqual(patient_ref.phone, "+91-9988776655")
        self.assertEqual(patient_ref.address, "123 Secretariat Road, New Delhi")
        self.assertEqual(patient_ref.emergency_contact_phone, "+91-9999988888")

        # 2. Query the raw SQLite database bypassing ORM to verify ciphertext storage
        # Replace the base URL to get local path
        db_path = get_settings().DATABASE_URL.replace("sqlite:///", "")
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(f"SELECT phone, address, emergency_contact_phone FROM patients WHERE id = '{self.patient.id}'")
        row = cursor.fetchone()
        conn.close()

        raw_phone = row[0]
        raw_address = row[1]
        raw_emergency_phone = row[2]

        print("=== Encryption Verification Result ===")
        print(f"Decrypted Phone (SQLAlchemy): {patient_ref.phone}")
        print(f"Raw Phone in DB (Ciphertext): {raw_phone}")
        print(f"Decrypted Address (SQLAlchemy): {patient_ref.address}")
        print(f"Raw Address in DB (Ciphertext): {raw_address}")

        # Assertions
        # Standard Fernet ciphertexts always start with "gAAAA" (base64 token header)
        self.assertTrue(raw_phone.startswith("gAAAA"))
        self.assertTrue(raw_address.startswith("gAAAA"))
        self.assertTrue(raw_emergency_phone.startswith("gAAAA"))

        # Decrypted fields must NOT equal the database ciphertexts
        self.assertNotEqual(raw_phone, "+91-9988776655")
        self.assertNotEqual(raw_address, "123 Secretariat Road, New Delhi")

if __name__ == "__main__":
    unittest.main()
