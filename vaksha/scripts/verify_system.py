import os
import sys
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.db import engine, Base
from scripts.seed import seed_database

def run_tests():
    # Re-init clean DB
    Base.metadata.drop_all(bind=engine)
    seed_database()

    with TestClient(app) as client:
        # 1. Health check
        res = client.get("/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        print("✓ GET /health PASSED:", res.json())

        # 2. People endpoint should start with 0 enrolled fake people
        res = client.get("/v1/people")
        assert res.status_code == 200, f"People list failed: {res.text}"
        people = res.json()
        assert len(people) == 0, f"Expected 0 enrolled people initially, got {len(people)}"
        print(f"✓ GET /v1/people PASSED: Clean initial DB (0 people).")

        # 3. Calls endpoint should start with 0 calls
        res = client.get("/v1/calls")
        assert res.status_code == 200, f"Calls list failed: {res.text}"
        calls = res.json()
        assert len(calls) == 0, f"Expected 0 calls initially, got {len(calls)}"
        print(f"✓ GET /v1/calls PASSED: Clean initial DB (0 calls).")

        # 4. Enroll Real Voice Identity via POST /v1/enroll
        samples_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples")
        real_wav_path = os.path.join(samples_dir, "cfo_real.wav")
        
        with open(real_wav_path, "rb") as f:
            files = {"audio": ("cfo_real.wav", f, "audio/wav")}
            data = {
                "person_code": "RS-CFO-001",
                "name": "Rahul Sharma",
                "role_title": "Chief Financial Officer",
                "org": "Union Bank Demo",
                "official_callback": "+91 98200 00001"
            }
            res = client.post("/v1/enroll", files=files, data=data)
            assert res.status_code == 200, f"Enrollment failed: {res.text}"
            enroll_res = res.json()
            assert enroll_res["person_code"] == "RS-CFO-001"
            assert len(enroll_res["audit_hash"]) > 0
            print(f"✓ POST /v1/enroll PASSED: Enrolled {enroll_res['name']} ({enroll_res['person_code']}). Audit SHA-256: {enroll_res['audit_hash'][:16]}...")

        # 5. Verify /v1/people now has 1 person
        res = client.get("/v1/people")
        people = res.json()
        assert len(people) == 1
        assert people[0]["name"] == "Rahul Sharma"
        print("✓ GET /v1/people PASSED: Enrolled person successfully fetched.")

        # 6. Detect Real Voice (with target person_code)
        with open(real_wav_path, "rb") as f:
            files = {"audio": ("cfo_real.wav", f, "audio/wav")}
            data = {"person_code": "RS-CFO-001"}
            res = client.post("/v1/detect", files=files, data=data)
            assert res.status_code == 200, f"Detect real voice failed: {res.text}"
            result = res.json()
            assert result["person_claimed"] == "Rahul Sharma"
            assert result["final_decision"] in ["ALLOW", "STEP_UP"]
            print("✓ POST /v1/detect (Real Sample targeted) PASSED:")
            print(f"   Call Ref: {result['call_ref']} | Decision: {result['final_decision']} | Speaker Match: {result['breakdown']['speaker_match']:.1f}%")

        # 7. Detect Clone Voice (Auto-Detect mode, 1-to-N matching, empty person_code)
        clone_wav_path = os.path.join(samples_dir, "cfo_clone.wav")
        with open(clone_wav_path, "rb") as f:
            files = {"audio": ("cfo_clone.wav", f, "audio/wav")}
            data = {
                "intent": "Executive Voice Impersonation Analysis",
                "amount_inr": 25000000.0
            }
            res = client.post("/v1/detect", files=files, data=data)
            assert res.status_code == 200, f"Detect clone failed: {res.text}"
            result = res.json()
            assert result["person_claimed"] == "Rahul Sharma"  # 1-to-N best matched Rahul Sharma
            assert result["final_decision"] == "BLOCK"
            print("✓ POST /v1/detect (CFO Clone 1-to-N Auto-Detect) PASSED:")
            print(f"   Call Ref: {result['call_ref']} | Person Matched: {result['person_claimed']} | Decision: {result['final_decision']} | Risk: {result['risk']:.1f}/100")

        # 8. Verify /v1/calls has 2 records
        res = client.get("/v1/calls")
        calls = res.json()
        assert len(calls) == 2
        print(f"✓ GET /v1/calls PASSED: {len(calls)} detection records available for Overview/Alerts.")

        # 9. Verify /v1/audit trail has hashes
        res = client.get("/v1/audit")
        logs = res.json()
        assert len(logs) >= 3  # 1 ENROLL + 2 DETECT
        print(f"✓ GET /v1/audit PASSED: {len(logs)} tamper-evident audit records present.")

    print("\nALL SYSTEM INTEGRITY VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()


if __name__ == "__main__":
    run_tests()
