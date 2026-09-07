import os
import sys
from fastapi.testclient import TestClient

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

def run_tests():
    client = TestClient(app)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("✓ GET /health PASSED:", res.json())

    # 2. People endpoint
    res = client.get("/v1/people")
    assert res.status_code == 200, f"People list failed: {res.text}"
    people = res.json()
    assert len(people) >= 2, "Expected at least 2 seeded people"
    print(f"✓ GET /v1/people PASSED: Found {len(people)} enrolled people.")

    # 3. Calls endpoint
    res = client.get("/v1/calls")
    assert res.status_code == 200, f"Calls list failed: {res.text}"
    calls = res.json()
    assert len(calls) >= 2, "Expected seeded calls VK-4419 and VK-4420"
    print(f"✓ GET /v1/calls PASSED: Found {len(calls)} call records.")

    # 4. Audit Log endpoint
    res = client.get("/v1/audit")
    assert res.status_code == 200, f"Audit list failed: {res.text}"
    audit_logs = res.json()
    assert len(audit_logs) >= 3, "Expected audit trail records"
    print(f"✓ GET /v1/audit PASSED: Found {len(audit_logs)} cryptographic SHA-256 audit logs.")

    # 5. Detect CFO Clone Audio
    samples_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "samples")
    clone_wav_path = os.path.join(samples_dir, "cfo_clone.wav")
    
    with open(clone_wav_path, "rb") as f:
        files = {"audio": ("cfo_clone.wav", f, "audio/wav")}
        data = {
            "person_code": "UB-CFO-0192",
            "intent": "High-Value Transfer",
            "amount_inr": 25000000.0,
            "caller_number": "+91 98200 88123"
        }
        res = client.post("/v1/detect", files=files, data=data)
        assert res.status_code == 200, f"Detect failed: {res.text}"
        result = res.json()
        print("✓ POST /v1/detect (CFO Clone Sample) PASSED:")
        print(f"   Call Ref: {result['call_ref']} | Decision: {result['final_decision']} | Risk: {result['risk']} | Meaning: {result['breakdown']['meaning']}")

    # 6. Detect Real CFO Audio
    real_wav_path = os.path.join(samples_dir, "cfo_real.wav")
    with open(real_wav_path, "rb") as f:
        files = {"audio": ("cfo_real.wav", f, "audio/wav")}
        data = {"person_code": "UB-CFO-0192"}
        res = client.post("/v1/detect", files=files, data=data)
        assert res.status_code == 200, f"Detect failed: {res.text}"
        result = res.json()
        print("✓ POST /v1/detect (CFO Real Sample) PASSED:")
        print(f"   Call Ref: {result['call_ref']} | Decision: {result['final_decision']} | Risk: {result['risk']}")

    # 7. Action Override Endpoint
    res = client.post("/v1/calls/VK-4419/action", json={
        "action": "BLOCK",
        "actor_email": "priya.nair@unionbank.in",
        "note": "Agent verified voice clone with SOC analyst."
    })
    assert res.status_code == 200, f"Action override failed: {res.text}"
    print("✓ POST /v1/calls/VK-4419/action PASSED:", res.json())

    print("\nALL SYSTEM INTEGRITY VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
