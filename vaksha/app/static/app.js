// Vaksha VoiceShield Application Core Logic

let currentCallRef = "VK-4419";
let activePersonaEmail = "priya.nair@unionbank.in";
let waveformAnimId = null;
let selectedAnalyzeBlob = null;

document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initWaveform();
    initJuryDemo();
    initAnalyzeFormHelpers();
    checkHealthStatus();
    loadOverviewData();
    loadTrustedPeople();
    loadFraudDeskQueue();
    loadAuditTrail();

    // Persona switcher
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
            if (data.engines) {
                const isMock = data.engines.mock;
                mockStatusEl.innerText = isMock ? "TRUE" : "FALSE";
                mockStatusEl.className = `mock-badge ${isMock ? 'true' : 'false'}`;
            }
        }
    } catch (err) {
        console.warn("Could not fetch /health status:", err);
    }
}

// Tab Switcher
function switchTab(tabId) {
    const tabs = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".tab-panel");

    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    const targetTab = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (targetTab) {
        targetTab.classList.remove("hidden");
        targetTab.classList.add("active");
    }

    const targetPanel = document.getElementById(tabId);
    if (targetPanel) {
        targetPanel.classList.add("active");
    }

    if (tabId === "tab-overview") loadOverviewData();
    if (tabId === "tab-trusted") loadTrustedPeople();
    if (tabId === "tab-fraud") loadFraudDeskQueue();
    if (tabId === "tab-audit") loadAuditTrail();
}

function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-tab");
            switchTab(targetId);
        });
    });
}

// Waveform Animation
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

// Analyze Voice Helpers
function initAnalyzeFormHelpers() {
    const btnClone = document.getElementById("btn-use-cfo-clone");
    const btnReal = document.getElementById("btn-use-cfo-real");

    if (btnClone) {
        btnClone.addEventListener("click", async () => {
            const res = await fetch("/data/samples/cfo_clone.wav");
            selectedAnalyzeBlob = await res.blob();
            alert("Loaded CFO AI Clone Sample (cfo_clone.wav) into Analyzer!");
        });
    }

    if (btnReal) {
        btnReal.addEventListener("click", async () => {
            const res = await fetch("/data/samples/cfo_real.wav");
            selectedAnalyzeBlob = await res.blob();
            alert("Loaded CFO Real Sample (cfo_real.wav) into Analyzer!");
        });
    }
}

// Submit Voice Analysis Form -> POST /v1/detect
async function submitVoiceAnalysis(e) {
    e.preventDefault();
    const personCode = document.getElementById("analyze-person-select").value;
    const intent = document.getElementById("analyze-intent").value;
    const amount = document.getElementById("analyze-amount").value;
    const phone = document.getElementById("analyze-phone").value;
    const fileInput = document.getElementById("analyze-file-input");

    let audioBlob = selectedAnalyzeBlob;
    let fileName = "sample.wav";

    if (fileInput.files[0]) {
        audioBlob = fileInput.files[0];
        fileName = fileInput.files[0].name;
    }

    if (!audioBlob) {
        // Default to cfo_clone.wav if no file selected
        const res = await fetch("/data/samples/cfo_clone.wav");
        audioBlob = await res.blob();
        fileName = "cfo_clone.wav";
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);
    formData.append("person_code", personCode);
    formData.append("intent", intent);
    formData.append("amount_inr", amount);
    formData.append("caller_number", phone);

    try {
        const response = await fetch("/v1/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(`POST /v1/detect error ${response.status}`);
        const data = await response.json();

        // Update Result View & Switch Tab
        updateResultUI(data);
        switchTab("tab-result");
    } catch (err) {
        alert(`Voice Inspection Error: ${err.message}`);
    }
}

// Update Result View UI
function updateResultUI(data) {
    currentCallRef = data.call_ref;
    document.getElementById("res-display-call-ref").innerText = data.call_ref;
    document.getElementById("res-display-person-name").innerText = data.person_claimed || "Rahul Sharma";
    if (data.official_callback) {
        document.getElementById("res-display-callback").innerText = data.official_callback;
    }

    const risk = data.risk;
    document.getElementById("res-display-risk-score").innerText = Math.round(risk);
    document.getElementById("res-display-ai-score").innerText = Math.round(data.breakdown.ai_fake_score) + "%";
    document.getElementById("res-display-match-score").innerText = Math.round(data.breakdown.speaker_match) + "%";
    document.getElementById("res-display-trust-score").innerText = Math.round(data.trust) + "%";

    const offset = 264 - (264 * (risk / 100));
    const circle = document.getElementById("res-meter-circle");
    circle.style.strokeDashoffset = offset;

    const decisionPill = document.getElementById("res-display-decision-pill");
    const banner = document.getElementById("result-banner");
    const bannerTitle = document.getElementById("res-banner-title");
    const bannerMsg = document.getElementById("res-banner-msg");
    const bannerIcon = document.getElementById("res-banner-icon");
    const bannerAction = document.getElementById("res-banner-action-text");

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

    document.getElementById("res-display-meaning").innerText = data.breakdown.meaning;
    document.getElementById("res-display-action-text").innerText = data.action;

    const reasonsContainer = document.getElementById("res-display-reasons-list");
    reasonsContainer.innerHTML = "";
    (data.reasons || []).forEach(r => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerText = r;
        reasonsContainer.appendChild(chip);
    });
}

// Jury Demo Panel Wiring (Live Detection View)
function initJuryDemo() {
    const btnReal = document.getElementById("btn-demo-real");
    const btnClone = document.getElementById("btn-demo-clone");
    const btnImpostor = document.getElementById("btn-demo-impostor");

    if (btnReal) btnReal.addEventListener("click", () => triggerLiveDemoSample("cfo_real.wav", "UB-CFO-0192"));
    if (btnClone) btnClone.addEventListener("click", () => triggerLiveDemoSample("cfo_clone.wav", "UB-CFO-0192"));
    if (btnImpostor) btnImpostor.addEventListener("click", () => triggerLiveDemoSample("impostor.wav", "UB-CFO-0192"));
}

async function triggerLiveDemoSample(fileName, personCode) {
    try {
        const audioRes = await fetch(`/data/samples/${fileName}`);
        const audioBlob = await audioRes.blob();

        const formData = new FormData();
        formData.append("audio", audioBlob, fileName);
        formData.append("person_code", personCode);
        formData.append("intent", "High-Value Fund Transfer (₹2.5 Crore)");
        formData.append("amount_inr", "25000000");

        const response = await fetch("/v1/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("POST /v1/detect failed");
        const data = await response.json();
        updateLiveDetectionUI(data);
    } catch (err) {
        alert(`Live Detection Error: ${err.message}`);
    }
}

function updateLiveDetectionUI(data) {
    currentCallRef = data.call_ref;
    document.getElementById("live-display-call-ref").innerText = data.call_ref;
    document.getElementById("live-display-person-name").innerText = data.person_claimed || "Rahul Sharma";
    if (data.official_callback) {
        document.getElementById("live-display-callback").innerText = data.official_callback;
    }

    const risk = data.risk;
    document.getElementById("live-display-risk-score").innerText = Math.round(risk);
    document.getElementById("live-display-ai-score").innerText = Math.round(data.breakdown.ai_fake_score) + "%";
    document.getElementById("live-display-match-score").innerText = Math.round(data.breakdown.speaker_match) + "%";
    document.getElementById("live-display-trust-score").innerText = Math.round(data.trust) + "%";

    const offset = 264 - (264 * (risk / 100));
    const circle = document.getElementById("live-meter-circle");
    circle.style.strokeDashoffset = offset;

    const decisionPill = document.getElementById("live-display-decision-pill");
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

    document.getElementById("live-display-meaning").innerText = data.breakdown.meaning;
    document.getElementById("live-display-action-text").innerText = data.action;

    const reasonsContainer = document.getElementById("live-display-reasons-list");
    reasonsContainer.innerHTML = "";
    (data.reasons || []).forEach(r => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.innerText = r;
        reasonsContainer.appendChild(chip);
    });
}

// Agent Action Decision Override
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
            loadFraudDeskQueue();
            loadAuditTrail();
        }
    } catch (e) {
        alert(`Action '${actionType}' recorded.`);
    }
}

// Submit Voice Enrollment -> POST /v1/enroll
async function submitEnrollment(e) {
    e.preventDefault();
    const code = document.getElementById("enroll-code").value;
    const name = document.getElementById("enroll-name").value;
    const role = document.getElementById("enroll-role").value;
    const callback = document.getElementById("enroll-callback").value;
    const fileInput = document.getElementById("enroll-file-input");

    let file = fileInput.files[0];
    if (!file) {
        const res = await fetch("/data/samples/cfo_real.wav");
        const blob = await res.blob();
        file = new File([blob], "cfo_real.wav", { type: "audio/wav" });
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
            loadTrustedPeople();
            loadAuditTrail();
        }
    } catch (err) {
        alert("Enrollment failed.");
    }
}

// Load Overview Data & Feed
async function loadOverviewData() {
    const tbody = document.getElementById("overview-feed-body");
    try {
        const res = await fetch("/v1/calls");
        if (res.ok) {
            const calls = await res.json();
            tbody.innerHTML = "";
            let blockedCount = 0;
            let stepupCount = 0;

            calls.slice(0, 10).forEach(c => {
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

            document.getElementById("ov-total-calls").innerText = calls.length;
            document.getElementById("ov-blocked").innerText = blockedCount;
            document.getElementById("ov-stepup").innerText = stepupCount;
        }
    } catch (e) {
        console.warn("Overview feed load fallback");
    }
}

// Load Enrolled People Registry
async function loadTrustedPeople() {
    const tbody = document.getElementById("trusted-people-body");
    try {
        const res = await fetch("/v1/people");
        if (res.ok) {
            const people = await res.json();
            tbody.innerHTML = "";
            people.forEach(p => {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${p.person_code}</strong></td>
                    <td>${p.name}</td>
                    <td>${p.role_title}</td>
                    <td>${p.org}</td>
                    <td class="teal">${p.official_callback}</td>
                    <td><span class="badge allow">${p.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
            document.getElementById("ov-enrolled-count").innerText = people.length;
        }
    } catch (e) {
        console.warn("People registry fallback");
    }
}

// Load Fraud Desk Queue
async function loadFraudDeskQueue() {
    const tbody = document.getElementById("fraud-queue-body");
    try {
        const res = await fetch("/v1/calls");
        if (res.ok) {
            const calls = await res.json();
            tbody.innerHTML = "";
            calls.forEach(c => {
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
                    <td>
                        <button class="btn-secondary btn-sm" onclick="quickOverrideAction('${c.call_ref}', 'BLOCK')">Block</button>
                        <button class="btn-secondary btn-sm" onclick="quickOverrideAction('${c.call_ref}', 'ALLOW')">Allow</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.warn("Fraud queue fallback");
    }
}

async function quickOverrideAction(callRef, action) {
    currentCallRef = callRef;
    await handleAgentAction(action);
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
        console.warn("Audit trail fallback");
    }
}
