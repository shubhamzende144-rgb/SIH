import logging

logger = logging.getLogger("vaksha.fusion")

def fuse_risk_and_decision(
    ai_fake_score: float,
    speaker_match: float,
    has_enrollment: bool = True,
    person_name: str = "Claimed Speaker"
) -> dict:
    """
    Fuses AI fake score and speaker match into a single risk score (0-100) and decision (ALLOW | STEP_UP | BLOCK).
    Calculates situation_bonus according to Vaksha product rules.
    """
    if not has_enrollment:
        # Unknown identity / unenrolled caller: AI-only score with warning
        risk = ai_fake_score
        trust = round(max(0.0, 100.0 - risk), 1)
        if ai_fake_score >= 70.0:
            decision = "BLOCK"
            meaning = "Unenrolled voice exhibits high synthetic artifacts."
            action = "Block transaction. Require in-person or multi-factor verification."
        elif ai_fake_score >= 40.0:
            decision = "STEP_UP"
            meaning = "Unenrolled identity with suspicious acoustic characteristics."
            action = "Perform step-up identity verification before proceeding."
        else:
            decision = "ALLOW"
            meaning = "Unenrolled identity, natural speech patterns detected."
            action = "Proceed with caution. Prompt user to enroll voiceprint."

        return {
            "risk": round(risk, 1),
            "trust": trust,
            "decision": decision,
            "meaning": meaning,
            "action": action
        }

    # Enrolled risk fusion
    # High speaker_match means caller IS the enrolled person.
    # Low speaker_match means caller is NOT the enrolled person.
    if speaker_match >= 70.0 and ai_fake_score >= 60.0:
        # Clone attack: sounds like enrolled person but voice is AI-generated
        risk = 0.40 * ai_fake_score + 0.60 * (100.0 - speaker_match + ai_fake_score)
        risk = max(70.0, min(100.0, risk))  # always BLOCK
        meaning = f"Sounds like {person_name}, but voice is AI-generated (clone attack)"
    elif speaker_match < 50.0:
        # Impostor: voice does not match enrolled person
        risk = 40.0 + 0.30 * (100.0 - speaker_match) + 0.20 * ai_fake_score
        risk = max(40.0, min(85.0, risk))  # STEP_UP or BLOCK
        meaning = f"Caller voice does not match enrolled profile of {person_name}"
    else:
        # Genuine enrolled speaker with matching voiceprint
        # High match + low AI → near-zero risk
        identity_confidence = speaker_match / 100.0
        risk = ai_fake_score * (1.0 - identity_confidence * 0.9)
        risk = max(0.0, min(39.9, risk))  # always ALLOW
        if ai_fake_score < 40.0:
            meaning = f"Authentic voice match for {person_name}"
        else:
            meaning = f"Speaker matches {person_name} with mild acoustic anomalies"

    risk = max(0.0, min(100.0, round(risk, 1)))
    trust = max(0.0, min(100.0, round(100.0 - risk, 1)))

    # Threshold mapping
    if risk >= 70.0:
        decision = "BLOCK"
        action = "Do not approve funds. Call back on official enrolled number."
    elif risk >= 40.0:
        decision = "STEP_UP"
        action = "Initiate official callback on registered mobile and trigger out-of-band MFA."
    else:
        decision = "ALLOW"
        action = "Voice integrity verified. Safe to proceed with request."

    return {
        "risk": risk,
        "trust": trust,
        "decision": decision,
        "meaning": meaning,
        "action": action
    }
