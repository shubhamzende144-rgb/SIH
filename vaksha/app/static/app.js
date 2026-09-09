// VoiceShield Application Logic - Screenshot Accurate Implementation

let currentCallRef = "VK-4419";
let activePersonaEmail = "security.admin@northstar.com";
let waveformAnimId = null;
let selectedAnalyzeBlob = null;

// Intercept fetch to append Bearer token
const originalFetch = window.fetch;
window.fetch = async (...args) => {
    let [resource, config] = args;
    if (typeof resource === 'string' && resource.startsWith('/v1/') && !resource.includes('/auth/login')) {
        config = config || {};
        config.headers = config.headers || {};
        const token = localStorage.getItem("vaksha_token");
        if (token) {
            if (config.headers instanceof Headers) {
                config.headers.set('Authorization', `Bearer ${token}`);
            } else {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        }
        args[1] = config;
    }
    const response = await originalFetch(...args);
    if (response.status === 401 && resource.startsWith('/v1/') && !resource.includes('/auth/login')) {
        handleLogout();
    }
    return response;
};

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("vaksha_token");
    if (token) {
        document.getElementById("login-overlay").style.display = "none";
        const startScreen = document.getElementById("start-screen");
        if (startScreen) startScreen.style.display = "none";
        document.getElementById("main-app").style.display = "flex";
        initApp();
        restoreSavedPage();
    }
});

function restoreSavedPage() {
    // Priority: hash route > sessionStorage > default overview
    const hash = window.location.hash.replace('#/', '');
    const stored = sessionStorage.getItem("vaksha_page");
    const route = (hash && routeToTab[hash]) ? hash : (stored && routeToTab[stored]) ? stored : null;
    if (route && routeToTab[route]) {
        switchTab(routeToTab[route]);
    }
}

window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace('#/', '');
    if (hash && routeToTab[hash]) {
        switchTab(routeToTab[hash]);
    }
});

function initApp() {
    initTabs();
    initWaveform();
    initJuryDemo();
    initAnalyzeFormHelpers();
    checkHealthStatus();
    loadOverviewData();
    loadTrustedPeople();
    loadAlertsData();
    loadAuditTrail();
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const errBox = document.getElementById("login-error");
    const btn = document.getElementById("btn-login-submit");
    
    btn.disabled = true;
    btn.innerText = "Authenticating...";
    errBox.style.display = "none";

    try {
        const res = await originalFetch("/v1/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.detail || "Login failed");
        }
        
        const data = await res.json();
        localStorage.setItem("vaksha_token", data.token);
        
        document.getElementById("login-overlay").style.display = "none";
        const startScreen = document.getElementById("start-screen");
        if (startScreen) startScreen.style.display = "none";
        document.getElementById("main-app").style.display = "flex";
        initApp();
        restoreSavedPage();
        
    } catch (e) {
        errBox.innerText = e.message;
        errBox.style.display = "block";
    } finally {
        btn.disabled = false;
        btn.innerText = "Sign In";
    }
}

function handleLogout() {
    localStorage.removeItem("vaksha_token");
    window.location.reload();
}

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
            const demoEngineBox = document.getElementById("demo-engine-box");
            if (demoEngineBox) {
                demoEngineBox.style.display = isMock ? "block" : "none";
            }
        } else {
            if (demoBanner) demoBanner.style.display = "none";
            const demoEngineBox = document.getElementById("demo-engine-box");
            if (demoEngineBox) demoEngineBox.style.display = "none";
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
const tabToRoute = {
    'tab-overview': 'overview', 'tab-analyze': 'analyze', 'tab-live': 'live',
    'tab-trusted': 'trusted', 'tab-history': 'history', 'tab-alerts': 'alerts',
    'tab-reports': 'reports', 'tab-settings': 'settings'
};
const routeToTab = Object.fromEntries(Object.entries(tabToRoute).map(([k,v]) => [v, k]));

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

    // Persist page
    const route = tabToRoute[tabId];
    if (route) {
        sessionStorage.setItem("vaksha_page", route);
        history.replaceState(null, "", `#/${route}`);
    }

    if (tabId === "tab-overview") loadOverviewData();
    if (tabId === "tab-trusted") loadTrustedPeople();
    if (tabId === "tab-alerts") loadAlertsData();
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
            <div class="cloud-icon-circle" id="record-btn-circle" style="background:rgba(239,68,68,0.15); cursor:pointer;" onclick="toggleRecording()">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
            </div>
            <h3 id="record-status-text">Click icon to Record</h3>
            <p id="record-sub-text">Speak clearly into your microphone for 5-10 seconds</p>
        `;
    }
}

let analyzeMediaRecorder;
let analyzeRecordedChunks = [];
let isAnalyzeRecording = false;

async function toggleRecording() {
    const statusText = document.getElementById("record-status-text");
    const subText = document.getElementById("record-sub-text");
    const iconContainer = document.getElementById("record-btn-circle");

    if (!isAnalyzeRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            analyzeMediaRecorder = new MediaRecorder(stream);
            analyzeRecordedChunks = [];
            
            analyzeMediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) analyzeRecordedChunks.push(e.data);
            };
            
            analyzeMediaRecorder.onstop = () => {
                selectedAnalyzeBlob = new Blob(analyzeRecordedChunks, { type: 'audio/webm' });
                selectedAnalyzeBlob.name = 'recorded_sample.webm';
                statusText.innerText = "Recording saved!";
                subText.innerText = "You can now run voice analysis.";
                iconContainer.style.background = "rgba(16, 185, 129, 0.15)";
                iconContainer.querySelector("svg").style.stroke = "#10b981";
            };

            analyzeMediaRecorder.start();
            isAnalyzeRecording = true;
            statusText.innerText = "Recording in progress...";
            subText.innerText = "Click icon again to stop.";
            iconContainer.style.background = "rgba(239, 68, 68, 0.5)";
            
        } catch (e) {
            alert("Error accessing microphone: " + e.message);
        }
    } else {
        analyzeMediaRecorder.stop();
        analyzeMediaRecorder.stream.getTracks().forEach(t => t.stop());
        isAnalyzeRecording = false;
    }
}

function onFileSelected(input) {
    if (input.files && input.files[0]) {
        selectedAnalyzeBlob = input.files[0];
        alert(`Selected File: ${input.files[0].name}`);
    }
}

let audioCtx = null;
let analyser = null;
let dataArray = null;

function initWaveform() {
    const canvas = document.getElementById("waveform-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Start with a flat line before audio context exists
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
}

function startVisualizer(sourceNode, currentCtx) {
    if (!analyser) {
        analyser = currentCtx.createAnalyser();
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
    }
    
    sourceNode.connect(analyser);
    // Note: Do NOT connect analyser to currentCtx.destination for MIC, only for AUDIO playback!
    // We will handle destination connection separately when setting up the source.

    const canvas = document.getElementById("waveform-canvas");
    const ctx = canvas.getContext("2d");

    if (waveformAnimId) cancelAnimationFrame(waveformAnimId);

    function draw() {
        waveformAnimId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#3b82f6";
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / dataArray.length;
        let x = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
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
        const [callsRes, peopleRes] = await Promise.all([
            fetch("/v1/calls"),
            fetch("/v1/people")
        ]);

        let calls = [];
        let people = [];
        if (callsRes.ok) calls = await callsRes.json();
        if (peopleRes.ok) people = await peopleRes.json();

        let aiCount = 0;
        let riskCount = 0;
        let chartData = { green: 0, red: 0, yellow: 0 };
        let latestCall = null;

        calls.forEach(c => {
            if (c.ai_fake_score > 50) aiCount++;
            if (c.risk > 70) riskCount++;

            if (c.decision === 'ALLOW') chartData.green++;
            else if (c.decision === 'BLOCK') chartData.red++;
            else chartData.yellow++;

            if (!latestCall || new Date(c.created_at) > new Date(latestCall.created_at)) {
                latestCall = c;
            }
        });

        // 1. UPDATE OVERVIEW CARDS
        const valAnalyzed = document.getElementById("ov-val-analyzed");
        const valAi = document.getElementById("ov-val-ai");
        const valRisk = document.getElementById("ov-val-risk");
        const valPeople = document.getElementById("ov-val-people");

        if (valAnalyzed) valAnalyzed.innerText = calls.length.toLocaleString();
        if (valAi) valAi.innerText = aiCount.toLocaleString();
        if (valRisk) valRisk.innerText = riskCount.toLocaleString();
        if (valPeople) valPeople.innerText = people.length.toLocaleString();

        // 2. UPDATE REPORTS TAB
        const repValEvals = document.getElementById("rep-val-evals");
        const repValBlocked = document.getElementById("rep-val-blocked");
        const repValLoss = document.getElementById("rep-val-loss");
        
        if (repValEvals) repValEvals.innerText = calls.length.toLocaleString();
        if (repValBlocked) repValBlocked.innerText = chartData.red.toLocaleString();
        if (repValLoss) {
            // Calculate a fake loss value based on actual events for demo purposes
            const amount = chartData.red * 1.2;
            repValLoss.innerText = `₹ ${amount.toFixed(1)} Cr`;
        }

        // Live tiles are NOT updated here — only updated by actual /v1/detect calls

        // 4. UPDATE CHART
        const chartContainer = document.getElementById("overview-bar-chart");
        const chartTotal = document.getElementById("overview-chart-total-events");
        if (chartContainer && calls.length > 0) {
            chartTotal.innerText = `${calls.length.toLocaleString()} events`;
            chartContainer.innerHTML = "";
            
            // Sort ascending to get chronological order for the chart (left to right)
            const chronologicalCalls = [...calls].sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
            const last20 = chronologicalCalls.slice(-20);
            
            last20.forEach(c => {
                const date = new Date(c.created_at);
                const timeLabel = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
                
                let bClass = "b-green";
                let h = 100 - (c.risk || 0);
                
                if (c.decision === 'BLOCK') {
                    bClass = "b-red";
                    h = c.risk;
                } else if (c.decision === 'STEP_UP') {
                    bClass = "b-yellow";
                    h = c.risk;
                }

                h = Math.max(10, Math.min(h, 100)); // cap height

                chartContainer.innerHTML += `
                    <div class="chart-col">
                        <div class="bars" style="display: flex; flex-direction: column; justify-content: flex-end;">
                            <span class="${bClass}" style="height:${h}%"></span>
                        </div>
                        <span class="time-label font-mono" style="font-size:10px">${timeLabel}</span>
                    </div>
                `;
            });
            
        } else if (chartContainer) {
            chartContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: #64748b; font-size: 13px;">No data to chart</div>`;
        }

        // 5. UPDATE RECENT EVENTS TABLE
        const tbody = document.getElementById("overview-events-body");
        if (tbody) {
            if (calls.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center text-dim" style="padding: 30px;">No detection events recorded yet. Perform an analysis in Analyze Voice.</td></tr>`;
            } else {
                tbody.innerHTML = "";
                // Sort calls descending
                const sortedCalls = [...calls].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
                sortedCalls.slice(0, 5).forEach(c => {
                    const tr = document.createElement("tr");
                    const timeStr = c.created_at ? new Date(c.created_at).toLocaleTimeString() : "--:--:--";
                    const riskVal = Math.round(c.risk || 0);
                    const isHighRisk = c.decision === 'BLOCK' || riskVal > 70;
                    const isSuspicious = c.decision === 'STEP_UP' || (riskVal > 40 && riskVal <= 70);
                    const badgeClass = isHighRisk ? 'badge-highrisk' : (isSuspicious ? 'badge-suspicious' : 'badge-genuine');
                    const dotClass = isHighRisk ? 'red' : (isSuspicious ? 'yellow' : 'green');
                    const textClass = isHighRisk ? 'text-red' : (isSuspicious ? 'text-yellow' : 'text-green');

                    tr.innerHTML = `
                        <td class="font-mono text-muted">${timeStr}</td>
                        <td><strong>${c.person_claimed || 'Unknown'}</strong> <span class="voice-id font-mono">#${c.call_ref}</span></td>
                        <td>${c.intent || 'Synthetic Voice Analysis'}</td>
                        <td><span class="score-dot ${dotClass}"></span> <strong class="${textClass} font-mono">${riskVal}</strong> <span class="text-dim font-mono">/100</span></td>
                        <td><span class="badge ${badgeClass}"><span class="dot ${dotClass}"></span> ${c.decision}</span></td>
                        <td><button class="action-link blue" onclick="switchTab('tab-analyze')">Review</button></td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (e) {
        console.warn("Overview data load error:", e);
    }
}

// Submit Voice Analysis -> POST /v1/detect
async function submitVoiceAnalysis(e) {
    e.preventDefault();
    const fileInput = document.getElementById("analyze-file-input");
    const selectedPersonCode = document.getElementById("analyze-person-select")?.value || "";

    let audioBlob = selectedAnalyzeBlob;
    let fileName = audioBlob ? (audioBlob.name || "sample.wav") : "sample.wav";

    if (fileInput && fileInput.files[0]) {
        audioBlob = fileInput.files[0];
        fileName = fileInput.files[0].name;
    }

    if (!audioBlob) {
        alert("Please upload or record audio first.");
        return;
    }

    const formData = new FormData();
    formData.append("audio", audioBlob, fileName);
    if (selectedPersonCode) {
        formData.append("person_code", selectedPersonCode);
    }
    formData.append("intent", "Executive Voice Impersonation Analysis");
    formData.append("amount_inr", "25000000");

    try {
        const response = await fetch("/v1/detect", {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            let errMsg = `POST /v1/detect error ${response.status}`;
            try {
                const errData = await response.json();
                errMsg = errData.error || errData.detail || errMsg;
            } catch (e) {}
            throw new Error(errMsg);
        }
        const data = await response.json();

        // Show render result box inline
        const resBox = document.getElementById("analyze-result-render");
        if (resBox) resBox.classList.remove("hidden");

        const risk = Math.round(data.risk);
        document.getElementById("res-score-risk").innerText = `${risk}/100`;
        document.getElementById("res-score-ai").innerText = `${Math.round(data.breakdown.ai_fake_score)}%`;
        document.getElementById("res-score-match").innerText = `${Math.round(data.breakdown.speaker_match)}%`;
        document.getElementById("res-score-ref").innerText = data.call_ref;
        document.getElementById("res-score-meaning").innerText = `Voice evaluation complete. Person: ${data.person_claimed}. Decision: ${data.final_decision}.`;

        const decisionBadge = document.getElementById("res-decision-badge");
        if (decisionBadge) {
            decisionBadge.innerText = data.final_decision;
            decisionBadge.className = data.final_decision === 'BLOCK' ? 'badge badge-highrisk' : (data.final_decision === 'STEP_UP' ? 'badge badge-suspicious' : 'badge badge-genuine');
        }

        // Refresh all real-time dashboards
        loadOverviewData();
        loadAuditTrail();
        loadAlertsData();

    } catch (e) {
        alert(`Voice Analysis Error: ${e.message}`);
    }
}

function initJuryDemo() {
    const btnReal = document.getElementById("btn-demo-real");
    const btnClone = document.getElementById("btn-demo-clone");
    const btnImpostor = document.getElementById("btn-demo-impostor");

    if (btnReal) btnReal.addEventListener("click", (e) => triggerLiveDemoSample(e.target, "cfo_real.wav", "UB-CFO-0192"));
    if (btnClone) btnClone.addEventListener("click", (e) => triggerLiveDemoSample(e.target, "cfo_clone.wav", "UB-CFO-0192"));
    if (btnImpostor) btnImpostor.addEventListener("click", (e) => triggerLiveDemoSample(e.target, "impostor.wav", "UB-CFO-0192"));
}

let currentJuryAudio = null;

async function triggerLiveDemoSample(btn, fileName, personCode) {
    if (currentJuryAudio) {
        currentJuryAudio.pause();
        currentJuryAudio = null;
    }
    
    // Disable button
    const origText = btn.innerText;
    btn.innerText = "⏳ Processing...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    const listeningPill = document.getElementById("live-listening-pill");
    const decisionBadge = document.getElementById("live-decision-badge");
    
    if (listeningPill) listeningPill.style.display = "inline-flex";
    if (decisionBadge) decisionBadge.style.display = "none";

    try {
        const audioRes = await fetch(`/data/samples/${fileName}`);
        if (!audioRes.ok) throw new Error("Audio file missing on server");
        const audioBlob = await audioRes.blob();

        // Play the audio for the jury
        currentJuryAudio = new Audio(URL.createObjectURL(audioBlob));
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sourceNode = audioCtx.createMediaElementSource(currentJuryAudio);
        startVisualizer(sourceNode, audioCtx);
        sourceNode.connect(audioCtx.destination); // Connect source to speakers
        currentJuryAudio.play();
        
        currentJuryAudio.onended = () => {
            if (listeningPill) listeningPill.style.display = "none";
            initWaveform(); // Reset to flatline
        };

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

        // Refresh dynamic UI views across all tabs
        loadOverviewData();
        loadAuditTrail();
        loadAlertsData();

    } catch (err) {
        alert(`Live Detection Error: ${err.message}`);
        if (listeningPill) listeningPill.style.display = "none";
        initWaveform();
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

let liveDetectHistory = [];

function updateLiveMetricsUI(data, isLiveMic = false) {
    let humanProb, aiProb, cloneProb, riskScore;

    if (isLiveMic) {
        liveDetectHistory.push(data);
        if (liveDetectHistory.length > 3) liveDetectHistory.shift();

        // Smooth
        const avgAi = liveDetectHistory.reduce((sum, d) => sum + d.breakdown.ai_fake_score, 0) / liveDetectHistory.length;
        const avgClone = liveDetectHistory.reduce((sum, d) => sum + d.breakdown.speaker_match, 0) / liveDetectHistory.length;
        const avgRisk = liveDetectHistory.reduce((sum, d) => sum + d.risk, 0) / liveDetectHistory.length;

        humanProb = 100 - Math.round(avgAi);
        aiProb = Math.round(avgAi);
        cloneProb = Math.round(avgClone);
        riskScore = Math.round(avgRisk);
        
        const sessionSub = document.getElementById("live-session-sub");
        if (sessionSub) sessionSub.innerText = `Window 8s · last detect ${data.call_ref}`;

    } else {
        liveDetectHistory = [data]; // Reset window for Jury demo so it's perfectly stable
        humanProb = 100 - Math.round(data.breakdown.ai_fake_score);
        aiProb = Math.round(data.breakdown.ai_fake_score);
        cloneProb = Math.round(data.breakdown.speaker_match);
        riskScore = Math.round(data.risk);
        
        const sessionSub = document.getElementById("live-session-sub");
        if (sessionSub) sessionSub.innerText = `Jury Demo · last detect ${data.call_ref}`;
    }

    // Set Main Smooth Values
    document.getElementById("live-val-human").innerText = `${humanProb}%`;
    document.getElementById("live-val-synthetic").innerText = `${aiProb}%`;
    document.getElementById("live-val-clone").innerText = `${cloneProb}%`;
    document.getElementById("live-val-risk").innerText = `${riskScore}/100`;

    document.getElementById("live-bar-human").style.width = `${humanProb}%`;
    document.getElementById("live-bar-synthetic").style.width = `${aiProb}%`;
    document.getElementById("live-bar-clone").style.width = `${cloneProb}%`;
    document.getElementById("live-bar-risk").style.width = `${riskScore}%`;

    // Set Sub 'Last' Values
    const lastHuman = 100 - Math.round(data.breakdown.ai_fake_score);
    const lastAi = Math.round(data.breakdown.ai_fake_score);
    const lastClone = Math.round(data.breakdown.speaker_match);
    const lastRisk = Math.round(data.risk);

    const elLastHuman = document.getElementById("live-last-human");
    const elLastSynthetic = document.getElementById("live-last-synthetic");
    const elLastClone = document.getElementById("live-last-clone");
    const elLastRisk = document.getElementById("live-last-risk");

    if (elLastHuman) elLastHuman.innerText = `Last: ${lastHuman}%`;
    if (elLastSynthetic) elLastSynthetic.innerText = `Last: ${lastAi}%`;
    if (elLastClone) elLastClone.innerText = `Last: ${lastClone}%`;
    if (elLastRisk) elLastRisk.innerText = `Last: ${lastRisk}/100`;

    const decisionBadge = document.getElementById("live-decision-badge");
    if (decisionBadge) {
        decisionBadge.innerText = data.final_decision;
        decisionBadge.style.display = "inline-flex";
        decisionBadge.className = data.final_decision === 'BLOCK' ? 'badge badge-highrisk margin-left' : (data.final_decision === 'STEP_UP' ? 'badge badge-suspicious margin-left' : 'badge badge-genuine margin-left');
    }
}

let liveMicStream = null;
let liveMicRecorder = null;
let liveMicInterval = null;

async function toggleLiveMic() {
    const btn = document.getElementById("live-mic-btn");
    const dot = document.getElementById("live-mic-dot");
    const text = document.getElementById("live-mic-text");
    const listeningPill = document.getElementById("live-listening-pill");

    if (liveMicStream) {
        if (liveMicRecorder && liveMicRecorder.state !== "inactive") {
            liveMicRecorder.stop();
        }
        clearInterval(liveMicInterval);
        liveMicStream.getTracks().forEach(t => t.stop());
        liveMicStream = null;
        liveMicRecorder = null;
        
        text.innerText = "START LIVE MIC";
        dot.style.backgroundColor = "#64748b";
        btn.style.boxShadow = "none";
        if (listeningPill) listeningPill.style.display = "none";
        initWaveform();
        return;
    }

    try {
        liveMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sourceNode = audioCtx.createMediaStreamSource(liveMicStream);
        startVisualizer(sourceNode, audioCtx);
        
        text.innerText = "MIC ACTIVE";
        dot.style.backgroundColor = "#ef4444";
        btn.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.5)";
        if (listeningPill) listeningPill.style.display = "inline-flex";

        function startChunk() {
            if (!liveMicStream) return;
            let chunks = [];
            liveMicRecorder = new MediaRecorder(liveMicStream);
            liveMicRecorder.ondataavailable = e => {
                if (e.data.size > 0) chunks.push(e.data);
            };
            liveMicRecorder.onstop = async () => {
                if (chunks.length === 0) return;
                const chunkBlob = new Blob(chunks, { type: 'audio/webm' });
                // We only upload if the recording lasted enough time to be useful
                if (chunkBlob.size > 500) {
                    const formData = new FormData();
                    formData.append("audio", chunkBlob, "live_chunk.webm");
                    formData.append("person_code", "UB-CFO-0192");

                    try {
                        const res = await fetch("/v1/detect", { method: "POST", body: formData });
                        if (res.ok) {
                            const data = await res.json();
                            updateLiveMetricsUI(data, true);
                            loadOverviewData();
                            loadAuditTrail();
                            loadAlertsData();
                        }
                    } catch(err) { console.error("Live chunk error", err); }
                }
            };
            liveMicRecorder.start();
        }

        startChunk();

        // Every 8 seconds, stop current recorder (triggers upload) and start a new one
        liveMicInterval = setInterval(() => {
            if (liveMicRecorder && liveMicRecorder.state === "recording") {
                liveMicRecorder.stop();
                startChunk();
            }
        }, 8000);

    } catch (e) {
        alert("Microphone error: " + e.message);
    }
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
                enrollAudioBlob = new Blob(recordedChunks, { type: "audio/webm" });
                enrollAudioBlob.name = 'enroll_sample.webm';
                if (label) label.innerText = `Recorded Audio Sample (${(enrollAudioBlob.size / 1024).toFixed(1)} KB WebM)`;
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
        alert("Please select or record an audio sample first.");
        return;
    }

    const formData = new FormData();
    formData.append("person_code", code);
    formData.append("name", name);
    formData.append("role_title", role);
    formData.append("org", "Union Bank Demo");
    formData.append("official_callback", callback);
    formData.append("audio", enrollAudioBlob, enrollAudioBlob.name || `${code}.wav`);

    const submitBtn = document.getElementById("btn-submit-enroll");
    if (submitBtn) { submitBtn.innerText = "Enrolling ML Voiceprint..."; submitBtn.disabled = true; }

    try {
        const response = await fetch("/v1/enroll", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!data.ok) {
            throw new Error(data.error || `Enrollment failed (HTTP ${response.status})`);
        }

        alert(`✓ Voiceprint enrolled for ${name} (${code})!\nSHA-256: ${data.audit_hash.slice(0, 16)}...`);
        
        closeRegisterVoiceModal();
        document.getElementById("form-register-voice").reset();
        enrollAudioBlob = null;
        loadTrustedPeople();
        loadOverviewData();
        loadAuditTrail();
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
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-dim" style="padding: 40px;">No trusted voices yet</td></tr>`;
        return;
    }

    people.forEach((p) => {
        const initials = getInitials(p.name);
        const tr = document.createElement("tr");
        const statusClass = p.status === "REVIEW" ? "badge-suspicious" : "badge-genuine";
        
        tr.innerHTML = `
            <td>
                <div class="employee-cell">
                    <span class="avatar-sm">${initials}</span>
                    <strong>${p.name}</strong>
                </div>
            </td>
            <td>${p.role_title}</td>
            <td><code class="font-mono text-cyan">${p.person_code}</code></td>
            <td><span class="text-dim font-mono">1 voiceprint</span></td>
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
                <button class="btn-icon" onclick="deletePerson('${p.person_code}', '${p.name.replace(/'/g, "\\'")}')" title="Remove identity" style="margin-left: 8px;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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

            const personSelect = document.getElementById("analyze-person-select");
            if (personSelect) {
                let opts = '<option value="">Auto-Detect (Compare against all enrolled voices)</option>';
                globalPeopleCache.forEach(p => {
                    opts += `<option value="${p.person_code}">${p.name} (${p.role_title} - ${p.person_code})</option>`;
                });
                personSelect.innerHTML = opts;
            }

            const valPeople = document.getElementById("ov-val-people");
            if (valPeople) valPeople.innerText = globalPeopleCache.length.toLocaleString();
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

async function deletePerson(personCode, personName) {
    if (!confirm(`Are you sure you want to remove the trusted voice for ${personName} (${personCode})?`)) {
        return;
    }
    try {
        const res = await fetch(`/v1/people/${personCode}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.detail || data.message || "Failed to delete person");
        }
        alert(data.message || `Deleted ${personCode}`);
        loadTrustedPeople();
        loadOverviewData();
    } catch (e) {
        alert("Error deleting person: " + e.message);
    }
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

// Load Dynamic Security Alerts from /v1/calls
async function loadAlertsData() {
    const container = document.getElementById("alerts-list-container");
    const badgeEl = document.getElementById("nav-alert-badge");
    if (!container) return;

    try {
        const res = await fetch("/v1/calls");
        if (res.ok) {
            const calls = await res.json();
            const alertCalls = calls.filter(c => c.risk > 50 || c.decision !== 'ALLOW');

            if (badgeEl) badgeEl.innerText = alertCalls.length.toString();

            if (alertCalls.length === 0) {
                container.innerHTML = `<div class="glass-card text-center text-dim" style="padding: 40px;">No threat alerts recorded yet. High-risk voice evaluations will appear here.</div>`;
                return;
            }

            container.innerHTML = "";
            alertCalls.forEach(c => {
                const borderClass = c.decision === 'BLOCK' ? 'border-red' : 'border-yellow';
                const badgeClass = c.decision === 'BLOCK' ? 'badge-highrisk' : 'badge-suspicious';
                const decisionColor = c.decision === 'BLOCK' ? 'text-red' : 'text-yellow';
                const title = c.decision === 'BLOCK' ? 'Executive Impersonation Attempt Blocked' : 'Suspicious Voice Encountered';
                const card = document.createElement("div");
                card.className = `glass-card margin-top ${borderClass}`;
                card.innerHTML = `
                    <div class="alert-header">
                        <div class="alert-title-row">
                            <span class="badge ${badgeClass}">${c.decision} ALERT</span>
                            <h3>${title}</h3>
                        </div>
                        <span class="font-mono text-dim">${c.created_at ? new Date(c.created_at).toLocaleTimeString() : 'Just now'}</span>
                    </div>
                    <p class="alert-desc margin-top-sm">Voice analysis for <strong>${c.person_claimed || 'Unknown Caller'}</strong> flagged high synthetic probability (${Math.round(c.ai_fake_score)}%) and speaker match (${Math.round(c.speaker_match)}%).</p>
                    <div class="alert-meta-row font-mono margin-top-sm">
                        <span>Ref: <strong>#${c.call_ref}</strong></span>
                        <span class="margin-left">Caller: <strong>${c.caller_number || '+91 98200 12345'}</strong></span>
                        <span class="margin-left">Decision: <strong class="${decisionColor}">${c.decision}</strong></span>
                    </div>
                    <div class="alert-actions-row margin-top">
                        <button class="btn-primary btn-sm" onclick="alert('Initiating callback to ${c.person_claimed || 'registered line'}...')">Initiate Callback</button>
                        <button class="btn-secondary btn-sm" onclick="alert('Alert #${c.call_ref} escalated to Security Desk.')">Escalate Alert</button>
                    </div>
                `;
                container.appendChild(card);
            });
        }
    } catch (e) {
        console.warn("Alerts load error:", e);
    }
}
