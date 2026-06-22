# Render Deployment Guide for VitalBridge (Bharath-Code-Quest) Backend

This guide walks you through deploying the FastAPI backend of your application on Render, connecting it to a PostgreSQL database, configuring environment variables, and seeding the database with realistic demo data.

---

## 1. Create a PostgreSQL Database on Render

To store patient data, telemetry, and triage logs, you need a PostgreSQL instance:

1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New** > **PostgreSQL**.
3. Configure the database details:
   - **Name**: `vitalbridge-db`
   - **Database**: `vitalbridge`
   - **User**: `dbadmin`
   - **Region**: Select a region close to your target users (or close to where you will host your Web Service).
   - **Plan**: Select the **Free** tier (or paid if preferred).
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (if deploying the backend on Render too) or the **External Database URL** (standard fallback).
   - *Example format*: `postgresql://dbadmin:pwd@host/vitalbridge`

---

## 2. Deploy the FastAPI Web Service

Now, deploy the Python application container on Render:

1. On your Render Dashboard, click **New** > **Web Service**.
2. Select **Build and deploy from a Git repository** and connect your `Bharath-Code-Quest` repository.
3. Configure the service settings:
   - **Name**: `vitalbridge-backend`
   - **Language**: `Docker` (since the repository contains a `Dockerfile` in the root of the backend folder)
   - **Region**: Same region as your database.
   - **Root Directory**: `backend` (tells Render to look inside the `backend` folder for the `Dockerfile`)
   - **Plan**: Select the **Free** tier (or paid).

---

## 3. Set Up Environment Variables

Under the **Environment** tab in your Render Web Service settings, add the following environment variables:

| Variable Name | Value / Description |
| :--- | :--- |
| `DATABASE_URL` | *Paste your PostgreSQL Database URL* (Render's internal or external connection string). |
| `SECRET_KEY` | *Generate a secure secret key* (e.g. run `openssl rand -hex 32` in your local terminal). |
| `DEBUG` | `false` |
| `CORS_ORIGINS` | `https://your-frontend.netlify.app` (replace with your actual Netlify frontend URL). |
| `GROK_API_KEY` | *Your OpenRouter/xAI API Key* |
| `GROK_MODEL` | `google/gemma-4-31b-it:free` (or your preferred LLM model identifier) |
| `GROK_BASE_URL` | `https://openrouter.ai/api/v1` |
| `TWILIO_ACCOUNT_SID` | *Optional Twilio SID for WhatsApp reports* |
| `TWILIO_AUTH_TOKEN` | *Optional Twilio Token* |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| `TWILIO_SMS_FROM` | *Optional Twilio number* |

Click **Save Changes**. Render will automatically build the Docker image and deploy the FastAPI container.

---

## 4. Database Setup & Seeding

The application uses an automatic table creation hook during the application startup, meaning **all tables will be created automatically in your PostgreSQL database on the first run**.

### Option A: Start with a Fresh, Empty Database
No additional steps are needed. The database will start empty and will populate as users register and log in.

### Option B: Seed with Realistic Indian Demo Data
If you want to populate the database with mock patients, doctors, ASHA workers, vitals, prescriptions, and live IoT dispenser configurations, you can run the seed script:

1. In the Render Dashboard, go to your **Web Service** page.
2. Click **Shell** in the left sidebar.
3. Run the following command in the terminal prompt:
   ```bash
   python -m app.db.seed
   ```
4. You should see `[OK] Database seeded successfully!`.

> [!CAUTION]
> The seed script runs `Base.metadata.drop_all(bind=engine)` before seeding, meaning it will **delete any existing tables and overwrite all existing data** in the database. Only run this on your initial setup!
