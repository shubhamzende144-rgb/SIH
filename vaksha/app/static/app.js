// VoiceShield Application Logic - Screenshot Accurate Implementation

let currentCallRef = "VK-4419";
let activePersonaEmail = "security.admin@northstar.com";
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
    loadAuditTrail();
});

// Check System Health & Update Footer Status & Demo Banner
async function checkHealthStatus() {
    try {
        const res = await fetch("/health");
        const demoBanner = document.getElementById("demo-mode-banner");
        const mockStatusEl = document.getElementById("footer-mock-status");

        if (res.ok) {
            const data = await res.json();
            const isMock = data.mock !== undefined ? data.mock : (data.engines ? data.engines.mock : true);
            
            if (mockStatusEl) {
                mockStatusEl.innerText = isMock ? "TRUE" : "FALSE";
                mockStatusEl.className = `mock-badge ${isMock ? 'true' : 'false'}`;
            }

            if (demoBanner) {
                demoBanner.style.display = isMock ? "flex" : "none";
            }
        } else {
            if (demoBanner) demoBanner.style.display = "none";
        }
    } catch (err) {
        console.warn("Could not fetch /health status:", err);
    }
}

// Toggle Notification Popup
function toggleNotifications() {
    const notifBox = document.getElementById("notif-dropdown");
    if (notifBox) {
        notifBox.classList.toggle("hidden");
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

    if (tabId === "tab-overview") loadOverviewData();
    if (tabId === "tab-trusted") loadTrustedPeople();
    if (tabId === "tab-history") loadAuditTrail();
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

// Toggle Analyze Tab (Upload vs Record)
function toggleAnalyzeTab(mode) {
    const btnUpload = document.getElementById("btn-toggle-upload");
    const btnRecord = document.getElementById("btn-toggle-record");
    const dropzone = document.getElementById("dropzone-area");

    if (mode === "upload") {
        if (btnUpload) btnUpload.classList.add("active");
        if (btnRecord) btnRecord.classList.remove("active");
        if (dropzone) dropzone.innerHTML = `
            <div class="cloud-icon-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M16 16l-4-4-4 4"></path><path d="M12 12v9"></path><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path></svg>
            </div>
            <h3>Drop an audio recording here</h3>
            <p>or <label for="analyze-file-input" class="browse-link">browse files</label> from your device</p>
            <span class="file-formats font-mono">WAV · MP3 · M4A · MAX 50MB</span>
            <input type="file" id="analyze-file-input" accept="audio/*" class="hidden-file-input" onchange="onFileSelected(this)">
        `;
    } else {
        if (btnRecord) btnRecord.classList.add("active");
        if (btnUpload) btnUpload.classList.remove("active");
        if (dropzone) dropzone.innerHTML = `
            <div class="cloud-icon-circle" style="background:rgba(239,68,68,0.15)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </div>
            <h3>Click to Record Live Audio Sample</h3>
            <p>Speak clearly into your microphone for 5-10 seconds</p>
        `;
    }
}

function onFileSelected(input) {
    if (input.files && input.files[0]) {
        selectedAnalyzeBlob = input.files[0];
        alert(`Selected File: ${input.files[0].name}`);
    }
}

// Waveform Canvas Animation
function initWaveform() {
    const canvas = document.getElementById("waveform-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let step = 0;
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#3b82f6";
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
        step += 0.35;
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
            alert("Loaded CFO AI Clone Sample (cfo_clone.wav)!");
        });
    }

    if (btnReal) {
        btnReal.addEventListener("click", async () => {
            const res = await fetch("/data/samples/cfo_real.wav");
            selectedAnalyzeBlob = await res.blob();
            alert("Loaded CFO Real Sample (cfo_real.wav)!");
        });
    }
}

// Load Overview Telemetry Stats & Table
async function loadOverviewData() {
    try {
        const res = await fetch("/v1/calls");
        if (res.ok) {
            const calls = await res.json();
            
            let aiCount = 0;
            let riskCount = 0;
            calls.forEach(c => {
                if (c.ai_fake_score > 50) aiCount++;
                if (c.risk > 70) riskCount++;
            });

            const valAnalyzed = document.getElementById("ov-val-analyzed");
            const valAi = document.getElementById("ov-val-ai");
            const valRisk = document.getElementById("ov-val-risk");

            if (valAnalyzed) valAnalyzed.innerText = (12840 + calls.length).toLocaleString();
            if (valAi) valAi.innerText = (1280 + aiCount).toLocaleString();
            if (valRisk) valRisk.innerText = (30 + riskCount).toString();
        }
    } catch (e) {
        console.warn("Overview data load fallback:", e);
    }
}

// Submit Voice Analysis -> POST /v1/detect
async function submitVoiceAnalysis(e) {
    e.preventDefault();
    const fileInput = document.getElementById("analyze-file-input");

    let audioBlob = selectedAnalyzeBlob;
    let fileName = "sample.wav";

    if (fileInput && fileInput.files[0]) {
        audioBlob = fileInput.files[0];
        fileName = fileInput.files[0].name;
    }

    if (!audioBlob) {
        const res = await fetch("/data/samples/cfo_clone.wav");
        audioBlob = await res.blob();
        fileName = "cfo_clone.wav";
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);
    formData.append("person_code", "UB-CFO-0192");
    formData.append("intent", "Executive Voice Impersonation Analysis");
    formData.append("amount_inr", "25000000");

    try {
        const response = await fetch("/v1/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(`POST /v1/detect error ${response.status}`);
        const data = await response.json();

        // Show render result box inline
        const resBox = document.getElementById("analyze-result-render");
        if (resBox) resBox.classList.remove("hidden");

        const risk = Math.round(data.risk);
        document.getElementById("res-score-risk").innerText = `${risk}/100`;
        document.getElementById("res-score-ai").innerText = `${Math.round(data.breakdown.ai_fake_score)}%`;
        document.getElementById("res-score-match").innerText = `${Math.round(data.breakdown.speaker_match)}%`;
        document.getElementById("res-score-ref").innerText = data.call_ref;
        document.getElementById("res-score-meaning").innerText = data.breakdown.meaning;

        const decisionBadge = document.getElementById("res-decision-badge");
        if (decisionBadge) {
            decisionBadge.innerText = data.final_decision;
            decisionBadge.className = `badge ${data.final_decision === 'BLOCK' ? 'badge-highrisk' : (data.final_decision === 'STEP_UP' ? 'badge-suspicious' : 'badge-genuine')}`;
        }
    } catch (err) {
        alert(`Voice Analysis Error: ${err.message}`);
    }
}

// Jury Demo Panel (Live Detection View)
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

        const response = await fetch("/v1/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("POST /v1/detect failed");
        const data = await response.json();
        
        updateLiveMetricsUI(data);
    } catch (err) {
        alert(`Live Detection Error: ${err.message}`);
    }
}

function updateLiveMetricsUI(data) {
    const humanProb = Math.round(data.trust);
    const aiProb = Math.round(data.breakdown.ai_fake_score);
    const cloneProb = Math.round(data.breakdown.speaker_match);
    const riskScore = Math.round(data.risk);

    document.getElementById("live-val-human").innerText = `${humanProb}%`;
    document.getElementById("live-val-synthetic").innerText = `${aiProb}%`;
    document.getElementById("live-val-clone").innerText = `${cloneProb}%`;
    document.getElementById("live-val-risk").innerText = `${riskScore}/100`;

    document.getElementById("live-bar-human").style.width = `${humanProb}%`;
    document.getElementById("live-bar-synthetic").style.width = `${aiProb}%`;
    document.getElementById("live-bar-clone").style.width = `${cloneProb}%`;
    document.getElementById("live-bar-risk").style.width = `${riskScore}%`;
}

let enrollAudioBlob = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecordingEnroll = false;
let globalPeopleCache = [];

function openRegisterVoiceModal() {
    const modal = document.getElementById("modal-register-voice");
    if (modal) modal.classList.remove("hidden");
}

function closeRegisterVoiceModal() {
    const modal = document.getElementById("modal-register-voice");
    if (modal) modal.classList.add("hidden");
}

function onEnrollFileSelected(input) {
    if (input.files && input.files[0]) {
        enrollAudioBlob = input.files[0];
        const label = document.getElementById("enroll-selected-file-name");
        if (label) label.innerText = `Selected File: ${input.files[0].name} (${(input.files[0].size / 1024).toFixed(1)} KB)`;
    }
}

async function toggleEnrollRecord(e) {
    e.preventDefault();
    const btn = document.getElementById("btn-enroll-record");
    const label = document.getElementById("enroll-selected-file-name");

    if (!isRecordingEnroll) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunks.push(event.data);
            };
            mediaRecorder.onstop = () => {
                enrollAudioBlob = new Blob(recordedChunks, { type: "audio/wav" });
                if (label) label.innerText = `Recorded Audio Sample (${(enrollAudioBlob.size / 1024).toFixed(1)} KB WAV)`;
            };
            mediaRecorder.start();
            isRecordingEnroll = true;
            if (btn) {
                btn.innerText = "⏹ Stop Recording";
                btn.style.background = "rgba(239, 68, 68, 0.3)";
            }
            if (label) label.innerText = "🎙 Recording mic audio... Speak into microphone...";
        } catch (err) {
            alert(`Microphone access error: ${err.message}`);
        }
    } else {
        if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        isRecordingEnroll = false;
        if (btn) {
            btn.innerText = "🎙 Record Mic Sample";
            btn.style.background = "";
        }
    }
}

async function submitVoiceEnrollment(e) {
    e.preventDefault();
    const name = document.getElementById("enroll-name").value.trim();
    const role = document.getElementById("enroll-role").value.trim();
    const code = document.getElementById("enroll-code").value.trim();
    const callback = document.getElementById("enroll-callback").value.trim();

    if (!enrollAudioBlob) {
        const res = await fetch("/data/samples/cfo_real.wav");
        enrollAudioBlob = await res.blob();
    }

    const formData = new FormData();
    formData.append("person_code", code);
    formData.append("name", name);
    formData.append("role_title", role);
    formData.append("org", "Union Bank Demo");
    formData.append("official_callback", callback);
    formData.append("audio", enrollAudioBlob, `${code}.wav`);

    const submitBtn = document.getElementById("btn-submit-enroll");
    if (submitBtn) { submitBtn.innerText = "Enrolling ML Voiceprint..."; submitBtn.disabled = true; }

    try {
        const response = await fetch("/v1/enroll", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Enrollment failed");
        }

        const data = await response.json();
        alert(`✓ Voiceprint successfully enrolled for ${name} (${code})! SHA-256 Audit Hash: ${data.audit_hash.slice(0, 16)}...`);
        
        closeRegisterVoiceModal();
        document.getElementById("form-register-voice").reset();
        enrollAudioBlob = null;
        loadTrustedPeople();
    } catch (err) {
        alert(`Enrollment Error: ${err.message}`);
    } finally {
        if (submitBtn) { submitBtn.innerText = "Submit & Enroll Voiceprint"; submitBtn.disabled = false; }
    }
}

function getInitials(name) {
    if (!name) return "VS";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
}

function renderPeopleRows(people) {
    const tbody = document.getElementById("trusted-people-body");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (people.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-dim">No trusted voice identities found.</td></tr>`;
        return;
    }

    people.forEach((p, idx) => {
        const initials = getInitials(p.name);
        const tr = document.createElement("tr");
        const statusClass = p.status === "REVIEW" ? "badge-suspicious" : "badge-genuine";
        const samplesCount = idx % 2 === 0 ? "5 samples" : "8 samples";
        
        tr.innerHTML = `
            <td>
                <div class="employee-cell">
                    <span class="avatar-sm">${initials}</span>
                    <strong>${p.name}</strong>
                </div>
            </td>
            <td>${p.role_title}</td>
            <td><code class="font-mono text-cyan">${p.person_code}</code></td>
            <td><span class="text-dim font-mono">${samplesCount}</span></td>
            <td>
                <span class="flex-align text-green font-mono" style="font-size: 11.5px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    Verified · ${new Date(p.created_at || Date.now()).toLocaleDateString()}
                </span>
            </td>
            <td><span class="badge ${statusClass}">• ${p.status || 'ACTIVE'}</span></td>
            <td>
                <button class="btn-icon" onclick="alert('Voiceprint Profile: ${p.name}\\nPerson Code: ${p.person_code}\\nCallback: ${p.official_callback}\\nConsent: GRANTED')" title="View identity details">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Load Enrolled People
async function loadTrustedPeople() {
    try {
        const res = await fetch("/v1/people");
        if (res.ok) {
            globalPeopleCache = await res.json();
            renderPeopleRows(globalPeopleCache);
        }
    } catch (e) {
        console.warn("People registry load error:", e);
    }
}

function filterPeopleTable() {
    const searchVal = (document.getElementById("search-people-input")?.value || "").toLowerCase();
    const statusVal = document.getElementById("filter-people-status")?.value || "ALL";

    const filtered = globalPeopleCache.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal) || p.person_code.toLowerCase().includes(searchVal) || p.role_title.toLowerCase().includes(searchVal);
        const matchesStatus = statusVal === "ALL" || (p.status || "ACTIVE") === statusVal;
        return matchesSearch && matchesStatus;
    });

    renderPeopleRows(filtered);
}

// Load Audit Trail
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
                    <td><span class="badge badge-genuine">${l.event_type}</span></td>
                    <td><strong>${l.ref_id}</strong></td>
                    <td><code class="font-mono teal">${l.payload_hash}</code></td>
                    <td>${l.actor}</td>
                    <td class="font-mono text-dim">${new Date(l.created_at).toLocaleString()}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {
        console.warn("Audit trail load error:", e);
    }
}
