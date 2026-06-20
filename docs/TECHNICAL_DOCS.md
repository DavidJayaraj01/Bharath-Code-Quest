# VitalBridge — Technical Documentation

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Backend API Reference](#2-backend-api-reference)
3. [Database Schema](#3-database-schema)
4. [AI Triage Engine](#4-ai-triage-engine)
5. [IoT Dispenser Simulator](#5-iot-dispenser-simulator)
6. [Disease Surveillance Engine](#6-disease-surveillance-engine)
7. [Real-Time Communication](#7-real-time-communication)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Deployment Guide](#10-deployment-guide)

---

## 1. System Architecture

VitalBridge follows a **layered monolith** architecture optimized for hackathon velocity with clear boundaries for future microservice extraction:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│     React 19 + TypeScript + Vite + TailwindCSS + Recharts        │
│     Leaflet Maps | Zustand State | WebSocket Clients             │
├─────────────────────────────────────────────────────────────────┤
│                         API GATEWAY                              │
│              FastAPI + CORS + JWT Bearer Auth                    │
├─────────┬─────────┬────────────┬──────────┬─────────────────────┤
│  Auth   │ Triage  │ Passport   │ Doctor   │ Surveillance  │ IoT │
│ Router  │ Router  │ Router     │ Router   │ Router        │Route│
├─────────┴─────────┴────────────┴──────────┴─────────────────────┤
│                        SERVICE LAYER                             │
│  AI Service (Grok) │ Surveillance Engine │ IoT State Machine    │
├─────────────────────────────────────────────────────────────────┤
│                        DATA LAYER                                │
│        SQLAlchemy ORM │ SQLite (dev) / PostgreSQL (prod)         │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Decisions

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Backend Framework | FastAPI | Native async support, automatic OpenAPI docs, WebSocket built-in |
| AI Provider | Grok (xAI) via OpenAI-compatible SDK | Abstracted behind `ai_service.py`; swap providers without business logic changes |
| Database | SQLite (dev) / PostgreSQL (prod) | Zero-config local dev; production-grade with Docker |
| Frontend | React 19 + Vite | Fast HMR, TypeScript-first, modern React features |
| Styling | TailwindCSS v4 | Utility-first, custom theme tokens, rapid iteration |
| State Management | Zustand | Minimal boilerplate, no provider nesting |
| Charts | Recharts | React-native chart library, composable |
| Maps | React-Leaflet | Free, open-source, no API key required |
| Real-time | WebSockets | Native browser support, bidirectional streaming |

---

## 2. Backend API Reference

Base URL: `http://localhost:8000/api`

### Auth (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Create account + auto-generate profile |
| POST | `/auth/login` | ❌ | Login → returns JWT + user object |
| GET | `/auth/me` | ✅ | Get current authenticated user |

### Triage (`/api/triage`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/triage/conversations` | Patient | Start new triage conversation |
| GET | `/triage/conversations` | Patient | List patient's conversations |
| GET | `/triage/conversations/{id}` | ✅ | Get conversation with messages |
| POST | `/triage/conversations/{id}/messages` | Patient | Send message (sync AI response) |
| WS | `/triage/ws/{id}?token=` | ✅ | Streaming AI chat via WebSocket |

### Passport (`/api/passport`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/passport/profile` | Patient | Get patient profile |
| PATCH | `/passport/profile` | Patient | Update patient profile |
| GET | `/passport/vitals` | Patient | Get vital readings |
| POST | `/passport/vitals` | Patient | Log new vital reading |
| GET | `/passport/prescriptions` | Patient | Get prescriptions |
| GET | `/passport/history` | Patient | Get visit history |

### Doctor (`/api/doctor`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/doctor/queue` | Doctor | Get escalated case queue |
| GET | `/doctor/patients/{id}` | Doctor | View patient record (requires access grant) |
| GET | `/doctor/patients/{id}/vitals` | Doctor | View patient vitals |
| GET | `/doctor/conversations/{id}` | Doctor | View triage conversation |
| POST | `/doctor/prescriptions` | Doctor | Write prescription + resolve case |
| WS | `/doctor/ws/queue?token=` | Doctor | Real-time queue updates |

### Surveillance (`/api/surveillance`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/surveillance/reports` | HW/DR/Admin | Get surveillance reports |
| GET | `/surveillance/summary` | HW/DR/Admin | Aggregated dashboard summary |
| WS | `/surveillance/ws?token=` | ✅ | Real-time surveillance updates |

### IoT (`/api/iot`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/iot/devices` | Patient | Get patient's dispenser devices |
| GET | `/iot/admin/devices` | HW/DR/Admin | All devices with adherence stats |
| GET | `/iot/devices/{id}/events` | ✅ | Device event history |
| POST | `/iot/devices/{id}/take-dose` | ✅ | Manual dose-taken trigger |
| POST | `/iot/devices/{id}/miss-dose` | ✅ | Manual dose-missed trigger |
| POST | `/iot/devices/{id}/reset` | ✅ | Reset device to locked state |
| WS | `/iot/ws/{id}?token=` | ✅ | Live device event stream |

---

## 3. Database Schema

### Entity Relationship

```
Users (1) ──── (1) Patients ──── (*) TriageConversations ──── (*) Messages
  │                  │                      │
  │                  │                      └── Prescriptions
  │                  │
  │                  ├── (*) VitalReadings
  │                  ├── (*) DispenserDevices ──── (*) DispenserEvents
  │                  └── (*) AccessGrants
  │
  └──── (1) Doctors ──── (*) AccessGrants
                    └── (*) Prescriptions
```

### Key Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `users` | Authentication base | email, hashed_password, role (enum) |
| `patients` | Demographics | gender, blood_group, allergies (JSON), chronic_conditions (JSON) |
| `doctors` | Professional info | specialty, license_number, hospital, years_experience |
| `triage_conversations` | Chat sessions | severity (enum), status (enum), chief_complaint, region, lat/lng |
| `messages` | Chat messages | role (patient/ai/doctor), content, metadata |
| `prescriptions` | Medications | medications (JSON array), diagnosis, notes |
| `vital_readings` | Health metrics | reading_type, value, unit, source |
| `surveillance_reports` | Outbreak data | region, symptom_category, case_count, risk_score, alert_level |
| `dispenser_devices` | IoT devices | medication_name, schedule_times (JSON), state (enum) |
| `dispenser_events` | State log | event_type, from_state, to_state, payload (JSON) |
| `access_grants` | Permission | patient_id, doctor_id, is_active |

---

## 4. AI Triage Engine

### Architecture

```
Patient Message → Build Context (history + demographics) → Grok API → Severity Extraction → Response
                                                                           │
                                                              HIGH → Escalate to Doctor Queue
                                                              LOW/MEDIUM → Home Care Guidance
```

### System Prompt Design
The AI system prompt is engineered for India's healthcare context:
- **5-language support**: Hindi, Tamil, Telugu, Kannada, Bengali + English
- **India-specific disease awareness**: dengue, malaria, typhoid, chikungunya, TB, leptospirosis
- **Cultural sensitivity**: dietary habits, traditional medicine (Ayurveda, Siddha), ASHA worker integration
- **Severity markers**: Bold `**Severity: HIGH**` markers parsed by `extract_severity()`
- **Vulnerable populations**: Lowered escalation threshold for children <5, pregnant women, elderly 65+

### Provider Abstraction
The AI service uses an OpenAI-compatible client. Swapping providers (e.g., Gemini, Llama) requires changing only `GROK_BASE_URL` and `GROK_MODEL` in `.env`.

---

## 5. IoT Dispenser Simulator

### State Machine

```
            ┌──── dose_window_open ────┐
            │                          │
  LOCKED ───┘                          ├──→ DISPENSED ──→ LOCKED
                                       │
                                       └──→ MISSED ────→ LOCKED
```

### Valid Transitions
| From | To | Trigger |
|------|----|---------|
| locked | dose_window_open | Scheduled time reached |
| dose_window_open | dispensed | Patient takes dose (85% probability in sim) |
| dose_window_open | missed | Dose window expires without action (15% probability) |
| dispensed | locked | Cycle reset |
| missed | locked | Cycle reset |

### Demo Day Compression
- Default: 120 seconds = 1 "day" (2 dose cycles per day)
- Configurable via `IOT_DEMO_DAY_SECONDS` environment variable
- Manual override endpoints allow instant state transitions during presentations

### Hardware Compatibility
The event schema mirrors a real ESP32 BLE GATT characteristic. Physical hardware can replace the simulator with **zero architecture changes** — only the event *source* changes.

---

## 6. Disease Surveillance Engine

### Clustering Algorithm
1. When a triage conversation completes, extract:
   - Geographic coordinates (lat/lng)
   - Symptom category (classified from chief complaint text)
2. Query all conversations from the past **48 hours**
3. For each, compute Haversine distance from the current conversation
4. Count matches within **50 km** with the same symptom category
5. Risk score = `min(1.0, matching_cases / 10)`

### Symptom Classification
| Category | Keywords |
|----------|----------|
| Respiratory | cough, breath, lung, throat, asthma, wheez, chest pain, pneumonia |
| Gastrointestinal | stomach, vomit, diarrhea, nausea, abdomen, loose motion |
| Fever | fever, temp, chill, sweat, typhoid, malaria, dengue |
| Neurological | headache, dizz, migraine, seizure, stroke, numb |
| Dermatological | rash, skin, itch, allergy, hives, burn |

### Alert Levels
| Level | Threshold | Dashboard Color |
|-------|-----------|-----------------|
| Normal | <3 matching cases | 🟢 Teal |
| Watch | 3–4 matching cases | 🔵 Blue |
| Warning | 5–7 matching cases | 🟡 Amber |
| Critical | 8+ matching cases | 🔴 Red |

---

## 7. Real-Time Communication

VitalBridge uses **4 WebSocket channels**:

| Channel | Purpose | Subscribers |
|---------|---------|-------------|
| `chat:{conversation_id}` | Streaming AI triage responses | Patient in active chat |
| `doctor_queue` | New escalation notifications | All connected doctors |
| `surveillance` | Outbreak updates + IoT adherence changes | Health workers, doctors, admins |
| `iot:{device_id}` | Dispenser state change events | Patient owning the device |

All WebSocket connections require JWT authentication via `?token=` query parameter.

---

## 8. Authentication & Authorization

### JWT Token Flow
1. Client POSTs credentials to `/api/auth/login`
2. Server validates password hash (bcrypt), returns JWT with `{sub: user_id, role: user_role}`
3. Client stores token in `localStorage` and attaches via `Authorization: Bearer <token>` header
4. Protected endpoints extract and validate the JWT on every request

### Role-Based Access Control (RBAC)

| Resource | Patient | Doctor | Health Worker | Admin |
|----------|---------|--------|---------------|-------|
| Triage Chat | ✅ Own | ❌ | ❌ | ❌ |
| Health Passport | ✅ Own | ✅ With grant | ❌ | ❌ |
| Doctor Queue | ❌ | ✅ | ❌ | ❌ |
| Surveillance Dashboard | ❌ | ✅ | ✅ | ✅ |
| IoT Devices | ✅ Own | ✅ Admin view | ✅ Admin view | ✅ Admin view |

### Access Grants
Patients must explicitly grant doctors access to their health records. Grants can be revoked at any time, ensuring the patient maintains ownership of their data.

---

## 9. Frontend Architecture

### Page Routing

| Path | Component | Role |
|------|-----------|------|
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/chat` | PatientChat | Patient |
| `/chat/:id` | PatientChat | Patient |
| `/passport` | PatientPassport | Patient |
| `/doctor` | DoctorDashboard | Doctor |
| `/doctor/case/:id` | DoctorCase | Doctor |
| `/surveillance` | SurveillanceDashboard | HW/Doctor/Admin |

### State Management
- **Zustand** store persists auth state to `localStorage`
- Automatic rehydration on page load
- Axios interceptors handle token injection and 401 redirects

### Design System
Custom TailwindCSS v4 theme with:
- Navy/teal/amber/coral palette
- Inter font family
- Glassmorphism effects
- Micro-animations (fadeIn, slideUp, pulse, countUp)
- Custom scrollbar styling

---

## 10. Deployment Guide

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SECRET_KEY` | ✅ | — | JWT signing key (64-char hex) |
| `GROK_API_KEY` | ✅ | — | xAI Grok API key for AI triage |
| `GROK_MODEL` | ❌ | `grok-3-mini` | LLM model identifier |
| `GROK_BASE_URL` | ❌ | `https://api.x.ai/v1` | AI API base URL |
| `DATABASE_URL` | ❌ | `sqlite:///./vitalbridge.db` | Database connection string |
| `CORS_ORIGINS` | ❌ | `http://localhost:5173,...` | Comma-separated allowed origins |
| `DEBUG` | ❌ | `true` | Enable SQL echo logging |
| `IOT_DEMO_DAY_SECONDS` | ❌ | `120` | Simulator time compression |

### Docker Production Deployment

```bash
# 1. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env with production values

# 2. Launch all services
docker-compose up --build -d

# 3. Seed the database (first time only)
docker-compose exec backend python -m app.db.seed

# 4. Access the application
# Frontend: http://localhost
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Database Seeding
The seed script (`python -m app.db.seed`) populates:
- 4 patients with realistic Indian demographics
- 2 doctors with specialties and hospital affiliations
- 1 ASHA health worker
- 1 admin account
- 2 triage conversations with message history
- 2 prescriptions with medication details
- 14 days of vital readings for all patients
- Surveillance reports across 8 Indian cities
- 1 IoT pill dispenser device with event history
