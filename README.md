# VITALBRIDGE
## AI-Powered Healthcare Continuum Platform for Bharat
### Complete Technical Documentation
*Bharat Academix CodeQuest Hackathon 2026*

---

## Executive Summary

India's healthcare crisis is structural: a 1:1,456 doctor-to-patient ratio, sub-40% chronic medication adherence in rural areas, and no unified patient record. VitalBridge closes the full loop — from first symptom to long-term adherence — in a single platform.

Four integrated layers cover AI triage, federated digital health records, real-time disease surveillance, and IoT-backed medication adherence. Built on **FastAPI + React + React Native + Grok AI** with a WebSocket-first real-time architecture, it ships as a fully production-grade application with zero mock data, zero placeholder buttons, and a one-command Docker deployment.

**Headline metrics:**
- **10M+** rural patients reached in Year 1
- **72hrs** outbreak early-warning window (vs. 2-week IDSP lag)
- **40%** target reduction in late-stage diagnosis
- **3×** target chronic medication adherence improvement

---

## Table of Contents

1. Problem Statement & Market Context
2. Solution Architecture — Four Integrated Layers
3. Core Technology Stack
4. Feature Deep-Dive: Features 1–6 (Original Production Set)
5. Feature Deep-Dive: Features 7–11 (Extension Set)
6. AI Engine & Bilingual Intelligence
7. Real-Time Architecture
8. Security, Privacy & Compliance
9. End-to-End Demo Flow
10. Updated Final Integration Checklist
11. Competitive Differentiation
12. Impact Projections & Roadmap

---

## 1. Problem Statement & Market Context

### The Three-Gap Crisis

India faces a compounding set of healthcare failures that no single existing solution addresses:

| Gap | Statistic | Consequence |
|---|---|---|
| **Diagnosis Gap** | 1:1,456 doctor-patient ratio (WHO recommends 1:1,000) | For 140 crore Indians, most patients never see a qualified doctor for initial triage. Disease is detected at Stage 3–4, when treatment is 5–10× more expensive and outcomes are dramatically worse. |
| **Medication Gap** | Sub-40% adherence in rural areas | Chronic disease patients (diabetes, hypertension, TB) miss doses at rates that make treatment ineffective. No real-time monitoring exists outside urban hospital settings. Preventable complications become expensive emergencies. |
| **Data Gap** | Zero unified health record | Every hospital visit starts from zero. Doctors decide without prior lab reports, medication history, or allergy records. Paper files get lost. Clinical context is destroyed at every care transition. |

### The Detection Lag Crisis

India's Integrated Disease Surveillance Programme (IDSP) takes an average of **2 weeks** from initial outbreak to official detection and response. In that window, an outbreak can cross district lines, infect thousands, and exhaust local health resources. VitalBridge's aggregated real-time triage data collapses this to a **72-hour early warning window**.

---

## 2. Solution Architecture — Four Integrated Layers

A closed-loop platform spanning first symptom to long-term adherence.

### L1 — AI Symptom Triage
*Grok-powered, multilingual, WhatsApp-styled chat*

Patients describe symptoms in natural language — Hindi or English. The AI assesses severity in real time with multi-turn context, streams the response token-by-token, and either provides evidence-based home-care guidance or escalates directly to a doctor queue. No app install required; zero barrier to entry.

- Real Grok API — zero canned responses, every triage is live AI reasoning
- WebSocket streaming — response appears token-by-token as it's generated
- Bilingual — auto-detects Hindi/English per message, responds in the same language
- Multi-turn context retention — AI remembers the full conversation arc
- Auto-escalation — High-severity assessment creates a real Doctor Queue entry in DB

### L2 — Federated Health Passport
*Patient-owned, lifetime digital health record*

A single digital identity for every patient: demographics, conditions, allergies, visit history, prescriptions, lab reports, and vitals — all in one place. Any doctor the patient authorizes can access the full record instantly. Built for ABDM and FHIR R4 compliance from day one.

- Patient controls access — explicit grant required per doctor
- Doctor-written prescriptions appear instantly via WebSocket — no page refresh
- Vitals trend charts — Recharts-powered, pulls from real VitalReading table
- QR-verified prescriptions — cryptographic signing, pharmacist-scannable
- Risk Score Gauge — live animated SVG gauge updated on every new data point

### L3 — Disease Surveillance Dashboard
*Real-time outbreak intelligence for health workers*

Aggregated, anonymized symptom data from live triage conversations feeds a real-time Leaflet heatmap. A computed Outbreak Probability Score (0–100%) per district is recalculated every 15 minutes using a formula weighting report volume, severity, and population baseline.

- Live Leaflet heatmap — intensity driven by Outbreak Probability Score
- District scoring — formula-computed, not manual tagging
- Trend detection — rising / stable / falling vs. 24-hour snapshots
- Auto-alert banner — fires when any district crosses 70% probability
- Drill-down card — hourly Recharts AreaChart per district + top symptoms
- 72-hour early warning vs. IDSP's 2-week reporting lag

### L4 — Medication Adherence (IoT + AI)
*Smart dispenser simulator with real BLE event schema*

A software-simulated smart pill dispenser runs a real BLE-style state machine. Every dispense and missed-dose event streams live via WebSocket to the patient app and a family/ASHA worker alert view. Built to plug directly into physical ESP32 hardware with zero architecture change.

- Real state machine: `LOCKED → DOSE_WINDOW_OPEN → DISPENSED/MISSED → LOCKED`
- Same event schema a real ESP32 BLE GATT device would emit
- Clearly labeled "Simulated Device" — never presented as live hardware
- Missed dose → real AlertRecord in DB → family/ASHA alert panel
- Accelerated demo time clearly labeled (1 day = 2 min in demo mode)

---

## 3. Core Technology Stack

| Layer | Technology | Why This Choice |
|---|---|---|
| **Web Frontend** | React 18 + TypeScript + Vite + TailwindCSS + Zustand + Recharts | Vite gives sub-second HMR; Zustand is minimal and WebSocket-friendly; Recharts covers every data viz need without a heavy chart library |
| **Mobile Frontend** | React Native (Expo) + TypeScript | Single codebase for iOS + Android; Expo Go eliminates build step for judges; shared TypeScript types with web |
| **Backend** | FastAPI (Python 3.11+) | Async-native, auto-generates OpenAPI docs, WebSocket-native without extra libraries, high throughput for streaming AI responses |
| **Database** | PostgreSQL + SQLAlchemy ORM + Alembic | SQLite for local dev; schema-identical swap via SQLAlchemy; Alembic for reproducible migrations |
| **AI** | Grok API via OpenAI-compatible SDK | `base_url='https://api.x.ai/v1'`; clean `ai_service.py` abstraction allows provider swap without touching business logic |
| **Real-time** | FastAPI WebSocket + in-memory pub/sub | Native WebSocket support; no external broker needed for hackathon scale; Redis-ready interface if scaling |
| **Auth** | JWT (python-jose) + bcrypt (passlib) | Industry-standard; role-based (patient / doctor / health_worker); refresh token support |
| **PDF Generation** | ReportLab + qrcode[pil] + Pillow | In-memory PDF generation; NotoSansDevanagari font for Hindi rendering; QR codes generated in-process |
| **Maps** | Leaflet + Leaflet.heat | Open-source, no API key needed for judges; heatmap layer via leaflet.heat plugin |
| **Infra** | Docker + docker-compose | One-command spin-up: backend + web + DB; no environment-specific setup required |
| **Lang Detection** | langdetect (Python) | Fast, offline; `detect()` returns `hi`/`en`; graceful fallback to Hindi for mixed/unknown input |
| **Crypto Signing** | Python `hmac` + `hashlib` (stdlib) | Zero dependencies; HMAC-SHA256 for prescription token signing; constant-time compare for timing-attack safety |
| **Predictive ML** *(new — F8)* | XGBoost (lightweight, trained on synthetic seed data) | No external ML infra needed; trains at startup, persists to `.pkl`, retrains only when missing |
| **Scheduling** *(new — F8, F11)* | APScheduler | In-process nightly jobs (readmission scoring) without a separate task queue |
| **Messaging** *(new — F8)* | Existing WhatsApp Business API integration | Reuses the same channel already wired for ASHA worker alerts — no new infra |

### Design System

| Token | Value | Usage |
|---|---|---|
| **Primary Theme Background** | `#FCEFC3` (Soft Custard / Cream) | Main layout backgrounds, login panels, clean contrast accents |
| **Primary Theme Accent** | `#FF9C5F` (Vibrant Peach / Orange) | Primary buttons, active tabs, map overlays, highlighting indicators |
| **Brand Logo & Favicon** | Transparent `logo.png` / high-res `favicon.png` | Integrated brand logo on authentication gateways, system headers, and browser tabs |
| **Primary Dark** | `#0D1B2A` (Deep Navy) | Dominant headers, text contrast, data-dense surfaces |
| **Primary Accent** | `#0D9488` / `#14B8A6` (Teal) | Alternate action states, positive indicators, and navigation icons |
| **Success/Light** | `#CCFBF1` (Mint) | Low-risk backgrounds, success states, light mode cards |
| **Warning** | `#F59E0B` (Amber) | Moderate risk, pending states, IoT warnings |
| **Critical** | `#EF4444` (Coral/Red) | High-risk alerts, error states, outbreak flags |
| **UI Pattern** | Rounded cards (12–16px radius), soft shadows, no accent stripes, Inter/system font | |
| **Motion** | Purposeful transitions: chat slide-in, number count-up, gauge needle animation (1.2s ease-out) | |

---

## 4. Feature Deep-Dive: Features 1–6 (Original Production Set)

All features ship as working production code — no placeholder buttons, no fake responses, no mock data outside the explicit `seed.py` script. Each has been designed for end-to-end demo reliability.

### F1 — Multilingual Voice Input (Speech-to-Text Triage)
*Web + React Native*

- Mic button in chat input bar — teal idle, red pulsing when recording (`animate-pulse`)
- Web Speech API with `hi-IN` / `en-IN` language toggle chip (हिंदी / EN)
- 3-bar waveform CSS animation during recording; 5-second silence auto-stop
- Transcript fills the input field — patient reviews and edits before sending (no auto-send)
- React Native: `expo-speech-recognition` with microphone permission flow
- Graceful degradation: "Voice not supported in this browser" on Firefox
- Transcribed text enters existing Grok triage flow unchanged — zero backend changes

### F2 — Patient Risk Stratification Score (Live Gauge)
*Server-computed, WebSocket-broadcast, animated SVG display*

- `risk_score_service.py`: weighted formula across triage severity, missed doses, abnormal vitals, age, and visit recency
- Score 0–100 with bands: Green (0–30 Low), Amber (31–65 Moderate), Red (66–100 High)
- Deductions for perfect adherence streak and all-normal vitals over 7 days
- `RiskScoreGauge.tsx`: hand-coded semicircular SVG arc — no external chart library
- Needle animates to score on mount (1.2s CSS ease-out transition); Red band pulses (`animate-pulse`)
- Collapsible "What's driving this?" section lists human-readable signal strings
- Doctor Queue: colored score badge per patient row; WebSocket broadcasts on every new triage or vital

### F3 — Outbreak Heatmap with Predictive Probability Score
*Leaflet.heat + formula-computed district scores + auto-alert*

- Formula: `(symptom_reports_48hrs × severity_weight_avg) / (population_baseline × daily_baseline_rate)`
- `OutbreakSnapshot` table: district scores snapshotted every 15 minutes via background task
- Trend detection: rising/stable/falling vs. 24h-ago snapshot with colored arrows
- Leaflet.heat heatmap layer: intensity = score/100; existing marker layer preserved for click-to-drill
- Sorted district score panel: score badge, trend arrow, 48hr report count
- Drill-down card: hourly Recharts AreaChart for last 24 hours + top 3 symptom chips
- Auto-alert red banner fires when any district > 70%; counts multiple districts; re-fires on further rises
- Score counter animation: counts 0→value on load (300ms ease-out); trend arrows fade in after

### F4 — AI Visit Summary PDF (Branded, Printable)
*ReportLab in-memory generation + QR code + NotoSansDevanagari font*

- `GET /api/reports/triage-summary/{id}` — StreamingResponse, `Content-Type: application/pdf`
- Layout: navy header bar, patient info block, colored severity assessment box, symptoms list
- Conversation transcript: alternating patient/AI rows, timestamps, max 10 exchanges shown
- QR code (qrcode library): encodes `https://vitalbridge.health/record/{patient_health_id}`
- Hindi-capable: `NotoSansDevanagari-Regular.ttf` registered with ReportLab for Devanagari rendering
- Frontend: "Download Summary" button appears post-severity-assessment; loading spinner during generation
- Mobile: `expo-file-system` + `expo-sharing` to download and share the PDF
- PDF generates in < 2 seconds for typical triage length

### F5 — Full Bilingual AI (Hindi ↔ English Auto-Detection)
*langdetect + dynamic system prompt + Devanagari PDF rendering*

- `langdetect.detect()` called on every patient message before the Grok API call
- Hindi → CRITICAL LANGUAGE INSTRUCTION injected into system prompt: full Devanagari response, formal register (आप), medical terms in English where no Hindi equivalent exists
- English → "Respond in clear, simple English" appended to system prompt
- Mixed input ("मुझे fever है") → defaults to Hindi
- `detected_language` column on Message model (Alembic migration); drives PDF font selection
- Language chip on every AI bubble: "🇮🇳 Hindi" / "🇬🇧 English" — 10px, informational only
- Hindi PDF: NotoSansDevanagari font loaded via `pdfmetrics.registerFont()` — zero garbled boxes

### F6 — QR-Verified Digital Prescription & Doctor Filtering
*HMAC-SHA256 signing + public verification endpoint + doctor location selector + patient location filtering*

- **QR Cryptographic Validation**: HMAC-SHA256 token = `base64url(payload).base64url(signature)` for secure scannable checks.
- **Doctor Registration & Location Mapping**: The registration flow (`Register.tsx`) requires doctors to input/pinpoint their clinic or hospital location on the interactive Leaflet map, which persists `city` in the database.
- **Doctor Dashboard Queue Filter**: Doctors can dynamically filter the escalated case queue using a new location selector layout:
  - **All Locations**: Displays aggregated escalated cases from all cities.
  - **Chennai Cases Only**: Filters the list dynamically to show only cases where the patient's location is "Chennai" (with counts).
  - **My Location**: Filters to display cases within the doctor's registered location (with counts).
- **Patient Location Badge**: Each queue card includes a `MapPin` badge (`• 📍 Chennai`) showing where the patient is located. Location info is broadcast live over WebSockets so new cases are filtered in real-time.

---

## 5. Feature Deep-Dive: Features 7–11 (Extension Set)

### F7 — Drug Interaction Checker

When a doctor adds a medication to a prescription, the system instantly checks it against the patient's existing medications and flags dangerous combinations before saving.

**Backend**
- New file: `backend/app/services/drug_interaction_service.py`
- Bundled static JSON: `backend/app/assets/drug_interactions.json`, containing ~200 common Indian drug pairs with severity levels (major, moderate, minor) and interaction descriptions
- Sourced from WHO Essential Medicines + OpenFDA public data
- On every prescription save: loop through all new + existing medications, check every pair against the JSON, return any matches
- Fully offline — no external API call, works in rural low-connectivity environments
- New endpoint: `POST /api/prescriptions/check-interactions`
  - Request: `{ existing_medications: list, new_medication: str }`
  - Response: `{ interactions: [{ drug_a, drug_b, severity, description }] }`

**Web**
- In the doctor's prescription form, after the doctor types a new medicine name and tabs out, fire the check silently in the background
- **Major interaction** → block form submission, show a red modal: "⚠ Dangerous Interaction Detected — [Drug A] + [Drug B]: [description]. Please review before proceeding."
- **Moderate interaction** → amber inline warning below the field, does not block submission
- **Minor interaction** → logged silently
- Doctor must explicitly click "Proceed Anyway" on major interactions, which logs an override reason in the DB

**Database**
- New table `InteractionOverride`: `prescription_id, drug_a, drug_b, severity, override_reason, overridden_by_doctor_id, overridden_at`

---

### F8 — Predictive 14-Day Readmission Risk

Every patient has a machine-learning-derived probability (0–100%) that they will need a hospital visit in the next 14 days. ASHA workers receive a proactive WhatsApp alert for high-risk patients before a crisis happens.

**Backend**
- New file: `backend/app/services/readmission_service.py`
- Lightweight XGBoost model, trained on seeded synthetic data at startup if no real data exists
- **Features:** missed doses in last 7 days, number of high-severity triages in last 30 days, abnormal vital readings in last 7 days, patient age, number of chronic conditions, days since last PHC visit, current risk score band
- **Target label:** had a triage event rated High within 14 days of the feature snapshot
- Train on app startup if `readmission_model.pkl` doesn't exist; save it; load it on subsequent starts
- Prediction runs **nightly via APScheduler** for all active patients
- New table `ReadmissionPrediction`: `patient_id, probability, risk_tier (low/medium/high), feature_snapshot_json, predicted_at`
- New endpoint: `GET /api/patients/{id}/readmission-risk` → returns the latest prediction

**ASHA Alert**
- When the nightly job runs and a patient crosses 70% probability, create a WhatsApp alert message (via existing WhatsApp Business API integration): *"VitalBridge Alert: [Patient Name] has a high risk of needing medical attention in the next 2 weeks. Please schedule a home visit."*
- Log the alert in new table `ProactiveAlert`

**Web**
- Doctor Portal patient list: new "14-day risk" column showing probability as a thin colored bar (green < 40%, amber 40–70%, red > 70%)
- Clicking opens a side panel showing which features drove the prediction (e.g., "Missed 4 doses this week contributes most to this score")

---

### F9 — Household Health Graph

ASHA workers track entire family units, not just individuals. A household view shows all family members on one screen with aggregate risk, so the ASHA worker can prioritize which households to visit first.

**Backend**
- New table `Household`: `id, village, district, address, asha_worker_id`
- New join table `HouseholdMember`: `household_id, patient_id, relationship`
- New endpoints:
  - `POST /api/households` — create a household
  - `POST /api/households/{id}/members` — add patients
  - `GET /api/households/{id}` — fetch full household with all member risk scores and latest vitals
- `household_risk_score` computed as the **max** individual risk score in the household — if any member is red, the household is red
- New `last_asha_visit` timestamp field on the Household model

**Web — ASHA Dashboard**
- New "Households" tab added to the existing ASHA worker dashboard
- Each household renders as a card showing: address, number of members, a small row of colored dots (one per member, colored by risk band), household risk level badge, days since last visit
- Cards sorted by household risk descending
- Click a household card → expands to show each member with name, age, risk score, and last triage date
- "Add Visit Note" button lets the ASHA worker log a visit, updating `last_asha_visit` and creating a `VisitLog` record

**Mobile**
- Same household card list as the primary home screen for ASHA worker role accounts

---

### F10 — AI Doctor Handoff Notes

When a triage conversation is escalated to a doctor (High severity outcome), the system auto-generates a structured clinical handoff note so any doctor who opens the case has full context in under 10 seconds — no need to read the full chat transcript.

**Backend**
- In `backend/app/services/ai_service.py`, after the triage engine assigns a High severity outcome, immediately fire a **second Grok API call** (non-blocking, runs as a background task so it doesn't delay the patient's response)
- System prompt for this call:

  > "You are a clinical documentation assistant. Given the following triage conversation, generate a structured handoff note for the receiving doctor. Output strictly in this JSON format: `{ chief_complaint, duration, associated_symptoms: [], relevant_history, vitals_mentioned: [], red_flags: [], suggested_examination_points: [], ai_triage_summary }`. Be concise. Each field maximum 2 sentences. Never invent information not present in the conversation."

- Store the generated JSON in new table `HandoffNote`: `conversation_id, note_json, generated_at, reviewed_by_doctor_id (nullable)`
- New endpoint: `GET /api/triage/{conversation_id}/handoff-note`

**Web — Doctor Portal**
- When a doctor opens a new escalated patient from the queue, before showing the full chat, display the handoff note as a structured card at the top: **Chief Complaint → Duration → Red Flags** (highlighted in red) **→ Suggested Examination**
- "Mark as Reviewed" button lets the doctor acknowledge it, setting `reviewed_by_doctor_id`
- Card collapses once reviewed so it doesn't clutter repeat visits

---

### F11 — Vaccination Drive Planner

District health officers can auto-generate a prioritized outreach list for vaccination drives based on age demographics, disease risk, and geographic clustering — replacing manual Excel-based planning.

**Backend**
- New file: `backend/app/services/vaccination_planner_service.py`
- New `VaccinationDrive` model: `id, vaccine_name, target_age_min, target_age_max, district, scheduled_date, status`
- New endpoint: `POST /api/vaccination/generate-plan`
  - Request: `{ vaccine_name, district, scheduled_date }`
  - Returns a prioritized patient list sorted by:
    1. Patients in the target age group who have no recorded vaccination for this vaccine
    2. Sorted by their current risk score descending
    3. With household address for geographic clustering, so ASHA workers can do area-by-area outreach efficiently
- New endpoint: `POST /api/vaccination/record`
  - Records that a patient received a vaccine
  - Creates a `VaccinationRecord` (`patient_id, vaccine_name, administered_at, administered_by, batch_number`)
  - Adds it to the patient's FHIR Health Passport

**Web — District Officer Dashboard**
- New "Vaccination Drives" section
- Form: officer picks vaccine name (dropdown: BCG, OPV, DPT, Hepatitis B, MMR, COVID-19 Booster), target district, and scheduled date
- On submit, the generated plan appears as a paginated table: patient name, age, village, household address, current risk score, ASHA worker assigned
- Officer can export the plan as CSV
- Each row has a checkbox — officer can select a subset and click "Assign to ASHA Workers," which creates tasks in the ASHA worker dashboard for those specific patients

**ASHA Mobile**
- New "Vaccination Tasks" tab shows the ASHA worker only their assigned patients for upcoming drives
- Each task has a "Mark Vaccinated" button that fires `POST /api/vaccination/record` and disappears from the list

---

## 6. AI Engine & Bilingual Intelligence

### Grok API Integration Architecture

The AI layer is built behind a clean abstraction (`ai_service.py`) so the underlying model can be swapped without touching business logic. Every call is live — the platform explicitly prohibits canned responses.

| Aspect | Detail |
|---|---|
| **Provider** | Grok API (xAI) via OpenAI-compatible SDK — `base_url='https://api.x.ai/v1'` (requires API key) |
| **Key Storage** | `GROK_API_KEY` in `.env` only — never committed to source; `.env.example` documents it |
| **Streaming** | FastAPI WebSocket streams tokens as they arrive — typing indicator then live text |
| **Context** | Full conversation history sent on every turn — true multi-turn with clinical continuity |
| **System Prompt** | Dynamic — base medical triage prompt + language instruction + severity schema injected per call |
| **Severity Output** | Structured: Low / Medium / High with reasoning paragraph, confidence, and recommendations |
| **Fallback** | `ai_service.py` interface designed for provider swap: replace `base_url` + key, zero logic changes |

### Language Detection Pipeline

`Patient Message → langdetect.detect() → hi / en / fallback → Lang instruction injected → Grok API call → Token stream → WebSocket to client`

### Triage Severity Scoring

The AI is prompted to produce a structured severity assessment with explicit reasoning. The system prompt enforces output format so the backend can reliably parse and store the severity band.

- **Low severity** → home-care guidance + conversation saved to Health Passport as a visit record
- **Medium severity** → detailed home-care + follow-up recommendation + saved to passport
- **High severity** → immediate Doctor Queue entry created in DB + patient confirmation screen + doctor WebSocket broadcast + **(new)** background Grok call generates the AI Handoff Note (F10)
- Every severity assessment triggers a Risk Score recomputation and WebSocket broadcast to all connected doctor views

---

## 7. Real-Time Architecture

WebSocket-first design — live everywhere, no polling.

### WebSocket Event Map

| WebSocket Channel | Publisher | Subscribers + Action |
|---|---|---|
| `ws://...chat/{conversation_id}` | `ai_service.py` (Grok token stream) | Patient chat UI — token-by-token text render with typing indicator |
| `ws://...doctor-queue` | Triage endpoint on High severity | Doctor Queue page — new case appears without refresh, sorted by severity |
| `ws://...passport/{patient_id}` | Prescription & vitals endpoints | Patient Passport + Doctor view — new data appears instantly |
| `ws://...risk/{patient_id}` | Risk score service (post-triage/vital) | Risk Gauge on Passport — needle animates to new value |
| `ws://...surveillance` | Triage endpoint (every new conversation) | Surveillance Dashboard — report count updates, score recalculated |
| `ws://...dispenser/{device_id}` | `iot_simulator.py` state machine | Patient app + family alert panel — dispense/missed events live |

### IoT Simulator State Machine

The medication adherence simulator implements the exact BLE GATT event schema a physical ESP32 smart-dispenser would produce. Physical hardware plugs in by replacing the event source only — the consumer (WebSocket downstream, DB writes, alert logic) is unchanged.

`LOCKED (waiting for dose window) → DOSE_WINDOW_OPEN (30s window, demo) → DISPENSED (dose taken) OR MISSED (→ Alert) → LOCKED`

Each state transition emits a real event record with `device_id`, `timestamp`, `event_type`, and `dose_id` — identical to what an ESP32 BLE characteristic notify would produce. A "Simulated Device" chip is always visible in the UI — never presented as real hardware.

---

## 8. Security, Privacy & Compliance

Production-grade security, ABDM-ready from day one.

| Area | Detail |
|---|---|
| **JWT Authentication** | python-jose + passlib bcrypt; real password hashing; real JWT issuance and validation; protected routes; role-based (patient / doctor / health_worker); no "fake login that accepts anything" |
| **RBAC** | Doctors can only access patients who have explicitly granted access; risk scores and passports respect the same authorization; no open access pattern |
| **Prescription Signing** | HMAC-SHA256 (Python stdlib `hmac`); `SIGNING_SECRET` in `.env` only; constant-time compare (`hmac.compare_digest`) prevents timing attacks; tampered tokens return 200 with `valid:false` — no information leakage |
| **Data Minimization** | Public `/verify` endpoint returns only patient first name + last initial; full patient data never returned to unauthenticated requests |
| **Surveillance Privacy** | Disease surveillance aggregates anonymized data only; no individual patient identifiers exposed in the dashboard layer |
| **Env Security** | `GROK_API_KEY` and `SIGNING_SECRET` in `.env` only; `.env.example` committed with placeholders and documentation; never in source code |
| **ABDM Readiness** | Schema design (FHIR R4 field alignment, Health ID as UUID field on Patient model) enables ABDM integration as a next-phase migration |
| **Form Validation** | Pydantic v2 server-side validation on all endpoints; client-side validation on all forms; errors surfaced with explicit messages — no silent failures |
| **Drug Interaction Data** *(F7)* | Fully offline interaction lookups — no PHI ever leaves the device/server pair for this check; sourced from public WHO/OpenFDA datasets |
| **Predictive Model Data** *(F8)* | Readmission model trains on synthetic seed data when real data is absent — no risk of overfitting to or leaking real patient records during cold start |

---

## 9. End-to-End Demo Flow

A 10-step demo with zero console errors, zero broken buttons. Reproducible in under 5 minutes by a judge who has run `docker-compose up`.

| Step | Flow |
|---|---|
| **01** | **Voice Input** — Patient opens mobile app → taps mic → speaks "मुझे तीन दिन से बुखार है" in Hindi → transcript auto-fills chat input in Devanagari script |
| **02** | **Hindi AI Triage** — Patient sends message → WebSocket connects → Grok response streams token-by-token in Hindi → language chip "🇮🇳 Hindi" appears on AI bubble |
| **03** | **High Severity Escalation** — AI assesses High severity → Doctor Queue entry created in DB → doctor portal shows new case in real time via WebSocket — no page refresh |
| **04** | **Risk Score Update** — New High-severity triage fires `risk_score_service.py` → Risk Score WebSocket broadcasts → patient's Risk Gauge animates to Red band on doctor view |
| **05** | **PDF Download** — Patient clicks "Download Summary" → ReportLab generates PDF in < 2s → Hindi text renders correctly in Devanagari → QR code in footer is scannable |
| **06** | **Doctor Registration** — Doctor registers in portal, clicks on the Leaflet map to specify their hospital/clinic city location, saving details securely to DB. |
| **07** | **Doctor Queue View** — Doctor opens dashboard, views the queue, and uses location tabs to filter cases. Toggles to "Chennai Only" or "My Location" to view matching escalated patient rows. |
| **08** | **Prescription + QR** — Doctor writes prescription → HMAC-SHA256 token auto-generated → QR code PNG stored → doctor clicks "View QR" → modal shows scannable QR |
| **09** | **QR Verification** — Pharmacist opens `/verify/{token}` in browser (no login) → animated green checkmark → doctor name, patient initials, medications table → verify page is public |
| **10** | **Surveillance Dashboard** — Health worker opens dashboard → Chennai district shows red heatmap zone → auto-alert banner: "⚠ Elevated outbreak risk in Chennai — Score: 78%" |

*Zero Console Errors · Zero Broken Buttons · Zero Hanging Loaders · Zero Mock Data Outside `seed.py`*

---

## 10. Updated Final Integration Checklist

*(Add these checks after the original Step 10 above.)*

1. Doctor opens a prescription form → types "Metformin" for a patient already on "Warfarin" → interaction warning fires before save
2. Nightly readmission job runs → patient with 4 missed doses + 2 high triages this week appears in red on the doctor's 14-day risk column
3. ASHA worker opens Households tab → sees a household with 3 members, one in red band → clicks to expand → logs a visit note
4. High-severity triage completes → doctor opens the queue → handoff note card is already populated with chief complaint and red flags before the doctor reads a single chat message
5. District officer generates a polio drive plan for Chennai → 47 patients listed by risk score → exports CSV → assigns 12 patients to an ASHA worker → ASHA worker sees the tasks on mobile

---

## 11. Competitive Differentiation

### Capability Matrix

| Capability | VitalBridge | Practo | eSanjeevani | Aarogya Setu | NetMeds | 1mg |
|---|---|---|---|---|---|---|
| AI symptom triage (live LLM) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Multilingual voice input | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Patient-owned health passport | ✓ | partial | partial | ✗ | ✗ | ✗ |
| Real-time disease surveillance | ✓ | ✗ | partial | partial | ✗ | ✗ |
| Outbreak probability score | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| IoT medication adherence | ✓ | ✗ | ✗ | ✗ | partial | ✗ |
| QR-verified prescriptions | ✓ | partial | ✗ | ✗ | ✗ | partial |
| Zero-install access (web chat) | ✓ | ✗ | partial | ✗ | ✗ | ✗ |
| FHIR R4 / ABDM readiness | ✓ | partial | ✓ | ✓ | ✗ | ✗ |
| Risk stratification score | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

### What Makes VitalBridge Different

- **Closed Loop** — No existing Indian platform covers triage → passport → surveillance → adherence in a single integrated system with shared real-time data.
- **Zero Install** — WhatsApp-styled web chat means patients with basic smartphones and no app install can access AI triage immediately.
- **Hardware-Ready IoT** — The simulator emits the exact ESP32 BLE event schema; physical hardware plugs in with no architecture change. This is not a demo gimmick; it's a real integration pathway.
- **Honest Simulation** — Every simulated or limited feature is clearly labeled in the UI. This is a differentiator in a hackathon context where honesty about scope is graded.
- **Production Grade** — One-command Docker deployment, real JWT auth, real RBAC, Alembic migrations, Pydantic v2 validation — this is a foundation ready for production deployment, not a prototype.
- **Proactive, Not Just Reactive** — Features 7–11 shift the platform from responding to symptoms (triage) toward preventing crises before they happen: drug-interaction blocking at the point of prescribing, 14-day readmission forecasting with proactive ASHA outreach, household-level risk aggregation, AI-assisted doctor handoffs, and systematic vaccination outreach planning.

---

## 12. Impact Projections & Roadmap

### Impact at Scale

| Metric | Target |
|---|---|
| Rural patients with first-time AI triage access in Year 1 | **10M+** |
| Outbreak detection vs. 2-week IDSP lag | **72hrs** |
| Potential reduction in late-stage disease diagnosis | **40%** |
| Target chronic disease adherence improvement | **3×** |

### Project Roadmap

| Phase | Timeline | Milestone |
|---|---|---|
| **P1** | Month 1–2 | MVP: WhatsApp-style AI triage + Federated Health Passport backend + full bilingual support |
| **P2** | Month 3–4 | Multi-language expansion (Tamil, Telugu, Bengali) + ASHA worker surveillance dashboard + ABDM integration |
| **P3** | Month 5–6 | Physical ESP32 IoT dispenser prototype + wearable vital monitor integration + hospital EHR connectors |
| **P4** | Month 7–9 | Pilot deployment with 2 Primary Health Centres (Tamil Nadu + Uttar Pradesh) + real patient data validation |
| **P5** | Month 10–12 | Full ABDM production integration + scale to 5 districts + WhatsApp Business API integration for zero-install national rollout |
