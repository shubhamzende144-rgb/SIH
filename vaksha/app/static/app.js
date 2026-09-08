// SatyaVani / Vaksha Voice Integrity Application Logic

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
    loadFraudDeskQueue();
    loadTrustedPeople();
    loadAuditTrail();
});

// Check System Health & Update Footer Status
async function checkHealthStatus() {
    try {
        const res = await fetch("/health");
        if (res.ok) {
            const data = await res.json();
            const mockStatusEl = document.getElementById("footer-mock-status");
            if (mockStatusEl && data.engines) {
                const isMock = data.engines.mock;
                mockStatusEl.innerText = isMock ? "TRUE" : "FALSE";
                mockStatusEl.className = `mock-badge ${isMock ? 'true' : 'false'}`;
            }
        }
    } catch (err) {
        console.warn("Could not fetch /health status:", err);
    }
}

// Tab Switcher Logic
function switchTab(tabId) {
    const navItems = document.querySelectorAll(".sidebar-nav-item");
    const panels = document.querySelectorAll(".tab-panel");

    navItems.forEach(item => {
        if (item.getAttribute("data-tab") === tabId) {
            item.classList.add("is-active", "active");
        } else {
            item.classList.remove("is-active", "active");
        }
    });

    panels.forEach(panel => {
        if (panel.id === tabId) {
            panel.classList.add("active");
        } else {
            panel.classList.remove("active");
        }
    });

    // Update topbar title
    const topbarTitle = document.getElementById("topbar-page-title");
    if (topbarTitle) {
        const titleMap = {
            "tab-fraud": "Fraud desk",
            "tab-live": "Live call",
            "tab-analyze": "Analyze voice",
            "tab-trusted": "Enroll voice",
            "tab-audit": "Audit log"
        };
        if (titleMap[tabId]) topbarTitle.innerText = titleMap[tabId];
    }

    if (tabId === "tab-fraud") loadFraudDeskQueue();
    if (tabId === "tab-trusted") loadTrustedPeople();
    if (tabId === "tab-audit") loadAuditTrail();
}

function initTabs() {
    const navItems = document.querySelectorAll(".sidebar-nav-item");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const tabId = item.getAttribute("data-tab");
            if (tabId) switchTab(tabId);
        });
    });
}

// Waveform Canvas Visualizer Animation
function initWaveform() {
    const canvas = document.getElementById("waveform-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let step = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#81ff89";
        ctx.beginPath();

        const width = canvas.width;
        const height = canvas.height;
        const sliceWidth = width / 100;
        let x = 0;

        for (let i = 0; i < 100; i++) {
            const v = Math.sin((i + step) * 0.15) * Math.cos((i * 0.1) + step * 0.2);
            const y = (v * (height / 3.5)) + (height / 2);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.stroke();
        step += 0.3;
        waveformAnimId = requestAnimationFrame(draw);
    }
    draw();
}

// Analyze Voice Form Helpers
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

// Submit Voice Analysis -> POST /v1/detect
async function submitVoiceAnalysis(e) {
    e.preventDefault();
    const personCode = document.getElementById("analyze-person-code").value;
    const intent = document.getElementById("analyze-intent-input").value;
    const amount = document.getElementById("analyze-amount-input").value;
    const phone = document.getElementById("analyze-phone-input").value;
    const fileInput = document.getElementById("analyze-file-input");

    let audioBlob = selectedAnalyzeBlob;
    let fileName = "sample.wav";

    if (fileInput && fileInput.files[0]) {
        audioBlob = fileInput.files[0];
        fileName = fileInput.files[0].name;
    }

    if (!audioBlob) {
        // Default to cfo_clone.wav
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

        // Update Fraud Desk Context Card & Switch to Fraud Desk View
        updateFraudDeskContextUI(data);
        switchTab("tab-fraud");
    } catch (err) {
        alert(`Voice Inspection Error: ${err.message}`);
    }
}

// Update Fraud Desk Context Card & Engine Breakdown
function updateFraudDeskContextUI(data) {
    currentCallRef = data.call_ref;
    
    // Header & Ref
    const refBadge = document.getElementById("fraud-call-ref-badge");
    if (refBadge) refBadge.innerText = data.call_ref;

    // Person & Caller
    const callerName = document.getElementById("fraud-caller-name");
    const callerPhone = document.getElementById("fraud-caller-phone");
    if (callerName) callerName.innerText = data.person_claimed || "Rahul Sharma";
    if (callerPhone) callerPhone.innerText = data.caller_number || "+91 98200 88123";

    // Intent & Amount
    const intentEl = document.getElementById("fraud-intent");
    const amountEl = document.getElementById("fraud-amount");
    if (intentEl) intentEl.innerText = data.intent || "High-Value Transfer";
    if (amountEl && data.amount_inr) {
        amountEl.innerText = `₹${Number(data.amount_inr).toLocaleString('en-IN')}`;
    }

    // Risk Meter & Decision Badge
    const risk = Math.round(data.risk);
    const riskScoreEl = document.getElementById("fraud-risk-score");
    if (riskScoreEl) riskScoreEl.innerText = risk;

    const statusBadge = document.getElementById("fraud-badge-status");
    const statusText = document.getElementById("fraud-status-text");
    if (statusText) statusText.innerText = data.final_decision;

    const meterRing = document.getElementById("fraud-meter-ring");
    let color = "#f56b6b"; // Danger / Block red
    if (data.final_decision === "ALLOW") color = "#10b981"; // Green
    if (data.final_decision === "STEP_UP") color = "#f59e0b"; // Warning amber

    if (meterRing) {
        meterRing.style.background = `conic-gradient(${color} 0 ${risk}%, #263445 ${risk}% 100%)`;
    }

    if (statusBadge) {
        if (data.final_decision === "BLOCK") {
            statusBadge.className = "risk-badge risk-badge-danger";
        } else if (data.final_decision === "STEP_UP") {
            statusBadge.className = "risk-badge badge stepup";
        } else {
            statusBadge.className = "risk-badge badge allow";
        }
    }

    // Risk Notes & Alert Box
    const noteTitle = document.getElementById("fraud-note-title");
    const noteCopy = document.getElementById("fraud-note-copy");
    const alertMsg = document.getElementById("fraud-alert-msg");

    if (noteTitle) {
        if (data.final_decision === "BLOCK") noteTitle.innerText = "High risk detected";
        else if (data.final_decision === "STEP_UP") noteTitle.innerText = "Verification required";
        else noteTitle.innerText = "Voice verified";
    }

    if (noteCopy) noteCopy.innerText = data.action || data.breakdown.meaning;
    if (alertMsg) alertMsg.innerHTML = `<strong>${data.breakdown.meaning}</strong>`;

    // Breakdown Scores
    const aiScoreEl = document.getElementById("fraud-ai-score");
    const matchScoreEl = document.getElementById("fraud-match-score");
    const trustScoreEl = document.getElementById("fraud-trust-score");

    if (aiScoreEl) aiScoreEl.innerText = `${Math.round(data.breakdown.ai_fake_score)}%`;
    if (matchScoreEl) matchScoreEl.innerText = `${Math.round(data.breakdown.speaker_match)}%`;
    if (trustScoreEl) trustScoreEl.innerText = `${Math.round(data.trust)}%`;

    // Reasons Chips
    const chipsContainer = document.getElementById("fraud-reasons-chips");
    if (chipsContainer) {
        chipsContainer.innerHTML = "";
        (data.reasons || []).forEach(r => {
            const chip = document.createElement("span");
            chip.className = "chip";
            chip.innerText = r;
            chipsContainer.appendChild(chip);
        });
    }

    // Refresh Incident Table
    loadFraudDeskQueue();
}

// Jury Demo Panel Wiring (Live Call View)
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
        updateFraudDeskContextUI(data);
    } catch (err) {
        alert(`Live Detection Error: ${err.message}`);
    }
}

function updateLiveDetectionUI(data) {
    currentCallRef = data.call_ref;

    const statusPill = document.getElementById("live-status-pill");
    const meterRing = document.getElementById("live-meter-ring");
    const riskScoreEl = document.getElementById("live-risk-score");
    const meaningText = document.getElementById("live-meaning-text");
    const actionText = document.getElementById("live-action-text");

    const risk = Math.round(data.risk);
    if (riskScoreEl) riskScoreEl.innerText = risk;
    if (statusPill) {
        statusPill.innerText = data.final_decision;
        statusPill.className = `risk-badge ${data.final_decision === 'BLOCK' ? 'risk-badge-danger' : (data.final_decision === 'STEP_UP' ? 'badge stepup' : 'badge allow')}`;
    }

    let color = "#f56b6b";
    if (data.final_decision === "ALLOW") color = "#10b981";
    if (data.final_decision === "STEP_UP") color = "#f59e0b";

    if (meterRing) {
        meterRing.style.background = `conic-gradient(${color} 0 ${risk}%, #263445 ${risk}% 100%)`;
    }

    if (meaningText) meaningText.innerText = data.breakdown.meaning;
    if (actionText) actionText.innerText = data.action;
}

// Agent Action Manual Decision Override
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
            alert(`Action '${actionType}' registered for call ${currentCallRef}.\nAudit Hash: ${data.audit_hash.substring(0, 16)}...`);
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
            const resBox = document.getElementById("enroll-result-box");
            if (resBox) resBox.classList.remove("hidden");
            
            document.getElementById("res-person-id").innerText = data.person_id;
            document.getElementById("res-quality").innerText = Math.round(data.quality_score * 100) / 100 + "%";
            document.getElementById("res-duration").innerText = data.duration_sec + "s";
            document.getElementById("res-hash").innerText = data.audit_hash;
            
            loadTrustedPeople();
            loadAuditTrail();
        }
    } catch (err) {
        alert("Enrollment failed.");
    }
}

// Load Fraud Desk Queue Table
async function loadFraudDeskQueue() {
    const tbody = document.getElementById("fraud-table-body");
    if (!tbody) return;
    try {
        const res = await fetch("/v1/calls");
        if (res.ok) {
            const calls = await res.json();
            tbody.innerHTML = "";
            calls.forEach(c => {
                const tr = document.createElement("tr");
                const decisionClass = c.decision.toLowerCase();
                tr.innerHTML = `
                    <td><strong>${c.call_ref}</strong></td>
                    <td>${c.person_claimed || "Rahul Sharma"}</td>
                    <td>${c.intent || "Transfer"}</td>
                    <td>${Math.round(c.ai_fake_score)}%</td>
                    <td>${Math.round(c.speaker_match)}%</td>
                    <td><strong>${Math.round(c.risk)}</strong></td>
                    <td><span class="badge ${decisionClass}">${c.decision}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.warn("Fraud queue load error:", e);
    }
}

// Load Enrolled People Registry Table
async function loadTrustedPeople() {
    const tbody = document.getElementById("trusted-people-body");
    if (!tbody) return;
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
                    <td>Union Bank</td>
                    <td class="teal">${p.official_callback}</td>
                    <td><span class="badge allow">ENROLLED</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.warn("People registry load error:", e);
    }
}

// Load Audit Log Trail Table
async function loadAuditTrail() {
    const tbody = document.getElementById("audit-table-body");
    if (!tbody) return;
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
        console.warn("Audit trail load error:", e);
    }
}
