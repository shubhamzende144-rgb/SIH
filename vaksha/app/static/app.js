// Vaksha SOC Application Core Logic

let currentCallRef = "VK-4419";
let activePersonaEmail = "priya.nair@unionbank.in";
let waveformAnimId = null;

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initWaveform();
    initJuryDemo();
    checkHealthStatus();
    loadSecurityQueue();
    loadAuditTrail();

    // Persona switch
    const personaSelect = document.getElementById("persona-select");
    if (personaSelect) {
        personaSelect.addEventListener("change", (e) => {
            activePersonaEmail = e.target.value;
        });
    }
});

// Check System Health & Update Footer Status
async function checkHealthStatus() {
    try {
        const res = await fetch("/health");
        if (res.ok) {
            const data = await res.json();
            const mockStatusEl = document.getElementById("footer-mock-status");
            const engineStatusEl = document.getElementById("footer-engine-status");
            
            if (data.engines) {
                const aiState = data.engines.ai ? "AI Active" : "AI Inactive";
                const spkState = data.engines.speaker ? "Speaker Active" : "Speaker Inactive";
                engineStatusEl.innerText = `${aiState} | ${spkState}`;
                
                const isMock = data.engines.mock;
                mockStatusEl.innerText = isMock ? "TRUE" : "FALSE";
                mockStatusEl.className = `mock-badge ${isMock ? 'true' : 'false'}`;
            }
        }
    } catch (err) {
        console.warn("Could not fetch /health status:", err);
    }
}

// Tab Navigation
function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".tab-panel");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));

            tab.classList.add("active");
            const targetId = tab.getAttribute("data-tab");
            document.getElementById(targetId).classList.add("active");

            if (targetId === "tab-sec") loadSecurityQueue();
            if (targetId === "tab-audit") loadAuditTrail();
        });
    });
}

// Canvas Waveform Animation
function initWaveform() {
    const canvas = document.getElementById("waveform-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let step = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#06b6d4";
        ctx.beginPath();

        const width = canvas.width;
        const height = canvas.height;
        const sliceWidth = width / 100;
        let x = 0;

        for (let i = 0; i < 100; i++) {
            const v = Math.sin((i + step) * 0.15) * Math.cos((i * 0.1) + step * 0.2);
            const y = (v * (height / 3)) + (height / 2);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.stroke();
        step += 0.4;
        waveformAnimId = requestAnimationFrame(draw);
    }
    draw();
}

// Jury Demo Controls Wiring (Calls /v1/detect on raw WAV audio file bytes)
function initJuryDemo() {
    const btnReal = document.getElementById("btn-demo-real");
    const btnClone = document.getElementById("btn-demo-clone");
    const btnImpostor = document.getElementById("btn-demo-impostor");

    if (btnReal) btnReal.addEventListener("click", () => triggerDemoSample("cfo_real.wav", "Rahul Sharma", "UB-CFO-0192"));
    if (btnClone) btnClone.addEventListener("click", () => triggerDemoSample("cfo_clone.wav", "Rahul Sharma", "UB-CFO-0192"));
    if (btnImpostor) btnImpostor.addEventListener("click", () => triggerDemoSample("impostor.wav", "Rahul Sharma", "UB-CFO-0192"));
}

async function triggerDemoSample(fileName, personName, personCode) {
    console.log(`Sending demo WAV audio file bytes for evaluation: /data/samples/${fileName}`);
    try {
        const audioResponse = await fetch(`/data/samples/${fileName}`);
        if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio sample /data/samples/${fileName}`);
        }
        const audioBlob = await audioResponse.blob();

        const formData = new FormData();
        formData.append("audio", audioBlob, fileName);
        formData.append("person_code", personCode);
        formData.append("intent", "High-Value Fund Transfer (₹2.5 Crore)");
        formData.append("amount_inr", "25000000");
        formData.append("caller_number", "+91 98200 88123");

        const response = await fetch("/v1/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`POST /v1/detect returned status ${response.status}`);
        }

        const data = await response.json();
        updateUIWithDetectionResult(data);
        loadSecurityQueue();
        loadAuditTrail();
    } catch (err) {
        console.error("Evaluation request failed:", err);
        alert(`Detection Error: ${err.message}`);
    }
}

function updateUIWithDetectionResult(data) {
    currentCallRef = data.call_ref;
    document.getElementById("display-call-ref").innerText = data.call_ref;
    document.getElementById("display-person-name").innerText = data.person_claimed || "Rahul Sharma";
    if (data.official_callback) {
        document.getElementById("display-callback").innerText = data.official_callback;
    }

    // Risk Meter & Trio
    const risk = data.risk;
    document.getElementById("display-risk-score").innerText = Math.round(risk);
    document.getElementById("display-ai-score").innerText = Math.round(data.breakdown.ai_fake_score) + "%";
    document.getElementById("display-match-score").innerText = Math.round(data.breakdown.speaker_match) + "%";
    document.getElementById("display-trust-score").innerText = Math.round(data.trust) + "%";

    // Circular Gauge Offset: r=42 -> Circumference = 264
    const offset = 264 - (264 * (risk / 100));
    const circle = document.getElementById("meter-circle");
    circle.style.strokeDashoffset = offset;

    // Meter & Pill colors based on decision
    const decisionPill = document.getElementById("display-decision-pill");
    const banner = document.getElementById("live-banner");
    const bannerTitle = document.getElementById("banner-title");
    const bannerMsg = document.getElementById("banner-msg");
    const bannerIcon = document.getElementById("banner-icon");
    const bannerAction = document.getElementById("banner-action-text");

    banner.className = "alert-banner";
    if (data.final_decision === "BLOCK") {
        circle.style.stroke = "#ef4444";
        decisionPill.innerText = "BLOCK";
        decisionPill.style.background = "rgba(239, 68, 68, 0.2)";
        decisionPill.style.color = "#f87171";

        banner.classList.add("banner-block");
        bannerIcon.innerText = "🚨";
        bannerTitle.innerText = "CRITICAL RISK: VOICE CLONE SUSPECTED!";
        bannerMsg.innerText = data.breakdown.meaning;
        bannerAction.innerText = "DO NOT APPROVE FUNDS";
    } else if (data.final_decision === "STEP_UP") {
        circle.style.stroke = "#f59e0b";
        decisionPill.innerText = "STEP_UP";
        decisionPill.style.background = "rgba(245, 158, 11, 0.2)";
        decisionPill.style.color = "#fbbf24";

        banner.classList.add("banner-stepup");
        bannerIcon.innerText = "⚠";
        bannerTitle.innerText = "STEP-UP VERIFICATION REQUIRED";
        bannerMsg.innerText = data.breakdown.meaning;
        bannerAction.innerText = "CALLBACK ENROLLED NUMBER";
    } else {
        circle.style.stroke = "#10b981";
        decisionPill.innerText = "ALLOW";
        decisionPill.style.background = "rgba(16, 185, 129, 0.2)";
        decisionPill.style.color = "#34d399";

        banner.classList.add("banner-allow");
        bannerIcon.innerText = "✓";
        bannerTitle.innerText = "VOICE INTEGRITY VERIFIED";
        bannerMsg.innerText = data.breakdown.meaning;
        bannerAction.innerText = "SAFE TO PROCEED";
    }

    // Meaning, Reasons & Action Text
    document.getElementById("display-meaning").innerText = data.breakdown.meaning;
    document.getElementById("display-action-text").innerText = data.action;

    const reasonsContainer = document.getElementById("display-reasons-list");
    reasonsContainer.innerHTML = "";
    (data.reasons || []).forEach(r => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerText = r;
        reasonsContainer.appendChild(chip);
    });
}

// Agent Manual Action Override
async function handleAgentAction(actionType) {
    try {
        const res = await fetch(`/v1/calls/${currentCallRef}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                action: actionType,
                actor_email: activePersonaEmail,
                note: `Agent override applied: ${actionType}`
            })
        });
        if (res.ok) {
            const data = await res.json();
            alert(`Action '${actionType}' registered for ${currentCallRef}.\nAudit Hash: ${data.audit_hash.substring(0, 16)}...`);
            loadSecurityQueue();
            loadAuditTrail();
        }
    } catch (e) {
        alert(`Action '${actionType}' recorded.`);
    }
}

// Submit Voice Enrollment
async function submitEnrollment(e) {
    e.preventDefault();
    const code = document.getElementById("enroll-code").value;
    const name = document.getElementById("enroll-name").value;
    const role = document.getElementById("enroll-role").value;
    const callback = document.getElementById("enroll-callback").value;
    const fileInput = document.getElementById("enroll-file-input");

    let file = fileInput.files[0];
    if (!file) {
        // Fetch real cfo_real.wav if no file uploaded
        try {
            const res = await fetch("/data/samples/cfo_real.wav");
            const blob = await res.blob();
            file = new File([blob], "cfo_real.wav", { type: "audio/wav" });
        } catch (err) {
            alert("Please select a WAV audio file to enroll.");
            return;
        }
    }

    const formData = new FormData();
    formData.append("person_code", code);
    formData.append("name", name);
    formData.append("role_title", role);
    formData.append("official_callback", callback);
    formData.append("audio", file);

    try {
        const res = await fetch("/v1/enroll", {
            method: "POST",
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            document.getElementById("res-person-id").innerText = data.person_id;
            document.getElementById("res-quality").innerText = data.quality_score + "%";
            document.getElementById("res-duration").innerText = data.duration_sec + "s";
            document.getElementById("res-hash").innerText = data.audit_hash;
            document.getElementById("enroll-result").classList.remove("hidden");
            loadAuditTrail();
        }
    } catch (err) {
        alert("Enrollment request failed.");
    }
}

// Load Security Queue
async function loadSecurityQueue() {
    const tbody = document.getElementById("calls-queue-body");
    try {
        const res = await fetch("/v1/calls");
        if (res.ok) {
            const calls = await res.json();
            tbody.innerHTML = "";
            let blockedCount = 0;
            let stepupCount = 0;

            calls.forEach(c => {
                if (c.decision === "BLOCK") blockedCount++;
                if (c.decision === "STEP_UP") stepupCount++;

                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${c.call_ref}</strong></td>
                    <td>${new Date(c.created_at).toLocaleTimeString()}</td>
                    <td>${c.person_claimed || "Unknown"}</td>
                    <td>${c.intent || "Transfer"}</td>
                    <td>${Math.round(c.ai_fake_score)}%</td>
                    <td>${Math.round(c.speaker_match)}%</td>
                    <td><strong>${Math.round(c.risk)}</strong></td>
                    <td><span class="badge ${c.decision.toLowerCase()}">${c.decision}</span></td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById("kpi-total-calls").innerText = calls.length;
            document.getElementById("kpi-blocked").innerText = blockedCount;
            document.getElementById("kpi-stepup").innerText = stepupCount;
        }
    } catch (e) {
        console.warn("Queue load fallback");
    }
}

// Load Audit Log Trail
async function loadAuditTrail() {
    const tbody = document.getElementById("audit-table-body");
    try {
        const res = await fetch("/v1/audit");
        if (res.ok) {
            const logs = await res.json();
            tbody.innerHTML = "";
            logs.forEach(l => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${l.id}</td>
                    <td><span class="chip">${l.event_type}</span></td>
                    <td><strong>${l.ref_id}</strong></td>
                    <td><code class="hash-block">${l.payload_hash}</code></td>
                    <td>${l.actor}</td>
                    <td>${new Date(l.created_at).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.warn("Audit load fallback");
    }
}
