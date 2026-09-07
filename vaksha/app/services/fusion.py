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

    # Enrolled risk fusion equation:
    # risk = 0.55 * ai_fake_score + 0.45 * situation_bonus
    if speaker_match >= 70.0 and ai_fake_score >= 60.0:
        situation_bonus = 100.0  # Clone of enrolled person (CRITICAL RISK)
        meaning = f"Sounds like {person_name}, but voice is AI-generated"
    elif speaker_match < 50.0:
        situation_bonus = 80.0   # Not the claimed person (IMPOSTOR)
        meaning = f"Caller voice does not match enrolled profile of {person_name}"
    else:
        situation_bonus = 20.0   # Enrolled speaker with low/normal AI artifacts
        if ai_fake_score < 40.0:
            meaning = f"Authentic voice match for {person_name}"
        else:
            meaning = f"Speaker matches {person_name} with mild acoustic anomalies"

    risk = 0.55 * ai_fake_score + 0.45 * situation_bonus
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
