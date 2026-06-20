<div align="center">

# 🏥 VitalBridge

### AI-Powered Healthcare Continuum Platform for Bharat

**Team Cipher Strike** — Bharat Academix CodeQuest 2026

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2019-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=for-the-badge&logo=docker)](https://docker.com/)

</div>

---

## 🎯 The Problem

India faces a **three-gap healthcare crisis** affecting 600M+ rural citizens:

| Gap | Statistic | Impact |
|-----|-----------|--------|
| **Diagnosis** | 1:1,456 doctor-to-patient ratio | 65% rural patients travel 30+ km for consultation |
| **Medication** | <40% chronic disease adherence | Diseases caught at Stage 3–4, when treatment is costly |
| **Data** | No unified health record | Every hospital visit starts from zero |

## 💡 The Solution

VitalBridge is a **closed-loop healthcare platform** spanning four integrated layers:

| Layer | Feature | Technology |
|-------|---------|------------|
| **Layer 1** | 🤖 AI Symptom Triage | Multilingual chat (5 Indian languages) powered by Grok AI |
| **Layer 2** | 📋 Health Passport | Lifelong patient-owned health record with vitals, prescriptions, history |
| **Layer 3** | 🗺️ Disease Surveillance | Real-time interactive outbreak map with 72-hour early warning |
| **Layer 4** | 💊 Medication Adherence | IoT smart pill dispenser with automated miss-dose alerts |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** and **Node.js 18+** (for local development)
- **Docker & Docker Compose** (for containerized deployment)
- **Grok API Key** from [xAI](https://x.ai/) (for AI triage)

### Option A: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/your-team/Bharath-Code-Quest.git
cd Bharath-Code-Quest

# 2. Backend Setup
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Create .env from template
cp .env.example .env
# Edit .env and add your GROK_API_KEY

# Seed the database with demo data
python -m app.db.seed

# Start the backend
uvicorn app.main:app --reload --port 8000

# 3. Frontend Setup (new terminal)
cd web
npm install
npm run dev
```

The app will be available at **http://localhost:5173**.

### Option B: Docker (One-Command Deploy)

```bash
# Set your API key
export GROK_API_KEY=your-key-here

# Launch everything (PostgreSQL + Backend + Frontend)
docker-compose up --build
```

The app will be available at **http://localhost**.

---

## 🔐 Demo Accounts

After seeding the database, the following accounts are available:

| Role | Email | Password |
|------|-------|----------|
| **Patient** | `priya.sharma@demo.vitalbridge.in` | `demo1234` |
| **Patient** | `arjun.patel@demo.vitalbridge.in` | `demo1234` |
| **Doctor** | `dr.ananya.iyer@demo.vitalbridge.in` | `demo1234` |
| **ASHA Worker** | `sunita.devi@demo.vitalbridge.in` | `demo1234` |
| **Admin** | `admin@demo.vitalbridge.in` | `admin1234` |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React + TypeScript                     │
│              (Vite + TailwindCSS + Recharts)             │
│   ┌──────────┬──────────┬──────────┬──────────────────┐  │
│   │ AI Chat  │ Health   │Outbreak  │ IoT Adherence    │  │
│   │ (WS)     │ Passport │ Map      │ Dashboard        │  │
│   └──────────┴──────────┴──────────┴──────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │ REST + WebSocket
┌─────────────────────────┴───────────────────────────────┐
│                    FastAPI (Python)                       │
│   ┌──────────┬──────────┬──────────┬──────────────────┐  │
│   │ Auth     │ Triage   │Surveill- │ IoT Simulator    │  │
│   │ (JWT)    │ (Grok)   │ ance     │ (State Machine)  │  │
│   └──────────┴──────────┴──────────┴──────────────────┘  │
│   ┌──────────────────────────────────────────────────┐   │
│   │         SQLAlchemy ORM + WebSocket Manager        │   │
│   └──────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│          SQLite (dev) / PostgreSQL (production)          │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
Bharath-Code-Quest/
├── backend/
│   ├── app/
│   │   ├── api/          # REST endpoints (auth, triage, passport, doctor, surveillance, iot)
│   │   ├── core/         # Config, JWT security, WebSocket manager
│   │   ├── db/           # Database session, seed script
│   │   ├── models/       # SQLAlchemy ORM models
│   │   ├── schemas/      # Pydantic v2 validation schemas
│   │   ├── services/     # AI service, IoT simulator, surveillance engine
│   │   └── main.py       # FastAPI entry point
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── web/
│   ├── src/
│   │   ├── api/          # Axios client with JWT interceptors
│   │   ├── components/   # Layout with role-based navigation
│   │   ├── pages/        # Login, Register, Chat, Passport, Doctor, Surveillance
│   │   ├── store/        # Zustand auth state
│   │   ├── types/        # TypeScript interfaces
│   │   ├── App.tsx       # Router configuration
│   │   └── index.css     # Design system & animations
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/
│   ├── TECHNICAL_DOCS.md
│   └── presentation.html
├── docker-compose.yml
└── README.md
```

---

## ✨ Key Features

### 🤖 AI Symptom Triage
- Real-time streaming chat via WebSockets
- 5 Indian languages: English, Hindi, Tamil, Telugu, Kannada, Bengali
- Automatic severity classification (Low / Medium / High)
- High-severity cases auto-escalate to the doctor queue
- India-specific endemic disease awareness (dengue, malaria, typhoid)

### 📋 Federated Health Passport
- Patient demographics, allergies, chronic conditions
- 14-day vital trend charts (heart rate, BP, SpO2, temperature)
- Complete prescription history with medication details
- Visit history with severity tracking

### 🗺️ Disease Surveillance Dashboard
- **Interactive Leaflet map** with color-coded outbreak markers
- Haversine distance clustering (50 km radius, 48-hour window)
- Real-time WebSocket updates when new triage data arrives
- Regional breakdown with bar and pie charts
- Alert levels: Normal → Watch → Warning → Critical

### 💊 IoT Medication Adherence
- ESP32-compatible state machine: `LOCKED → DOSE_WINDOW_OPEN → DISPENSED/MISSED → LOCKED`
- Real-time WebSocket event streaming
- Adherence rate calculation and tracking
- Manual demo controls: Take Dose, Miss Dose, Reset Device
- Missed-dose alerts broadcast to surveillance dashboard

### 👨‍⚕️ Doctor Dashboard
- Real-time escalated case queue via WebSockets
- Full patient history, vitals, and allergy review
- Prescription writing with medication management
- Access-controlled patient record viewing

---

## 🛡️ Security

- **JWT Authentication** with bcrypt password hashing
- **Role-based access control** (patient, doctor, health_worker, admin)
- **Access grants** — patients must explicitly grant doctors access to their records
- **CORS** configuration for whitelisted origins
- **Designed for ABDM compliance** (Ayushman Bharat Digital Mission)

---

## 🧑‍🤝‍🧑 Team Cipher Strike

| Member | Role |
|--------|------|
| **David Jayaraj A** | AI/ML Engineer |
| **Jerwin Titus D** | Full Stack Developer |
| **Daphne Christina Nelson** | IoT & Systems |

**Institution:** Karunya Institute of Technology and Sciences

---

## 📄 License

This project was built for the **Bharat Academix CodeQuest 2026** hackathon.
