# Netlify Deployment Guide for VitalBridge (Bharath-Code-Quest) Frontend

This guide walks you through the process of deploying the frontend (Vite/React/TypeScript) of your application on Netlify.

---

## 1. Automatic Configuration (`netlify.toml`)

We have created a `netlify.toml` file at the root of your repository to automatically configure the build settings and API routing on Netlify.

### What is configured:
1. **Build Settings**:
   - **Base directory**: `web` (tells Netlify where the React project files are)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
2. **API Proxying**:
   - Proxies `/api/*` requests to your production backend to prevent CORS issues.
3. **Single Page Application Routing**:
   - Redirects all other routes (`/*`) to `/index.html` (prevents 404 errors when reloading pages like `/chat/123`).

> [!IMPORTANT]
> Open the [netlify.toml](../netlify.toml) file in your editor and replace the placeholder backend URL (`https://your-backend-api-url.onrender.com`) with your actual deployed backend API URL.

---

## 2. WebSocket Configuration (Production)

Netlify redirects do **not** support proxying WebSockets (`ws://` or `wss://`). Therefore, we updated the React codebase across all pages to check for a custom environment variable `VITE_BACKEND_WS_URL` in production:
* **Development**: Automatically falls back to `ws://localhost:8000` (or `wss://...` if HTTPS is used).
* **Production**: Connects directly to the URL specified in your Netlify Environment Variables.

### What you need to do:
When deploying on Netlify, you **must** configure an environment variable:
* **Key**: `VITE_BACKEND_WS_URL`
* **Value**: `wss://your-backend-api-url.onrender.com` (replace with your production backend domain, starting with `wss://` for secure WebSockets).

---

## 3. Step-by-Step Deployment on Netlify

Follow these steps to deploy using the Netlify UI:

### Step 1: Import Project
1. Log in to your Netlify Dashboard.
2. Click **Add new site** > **Import an existing project**.
3. Connect your Git provider and select the `Bharath-Code-Quest` repository.

### Step 2: Build Settings
Netlify will automatically detect the settings from `netlify.toml`. Verify they match:
* **Base directory**: `web`
* **Build command**: `npm run build`
* **Publish directory**: `web/dist` (or `dist` if relative to base)

### Step 3: Add Environment Variables
1. Under **Environment variables**, click **Add variable**.
2. Add:
   - **Key**: `VITE_BACKEND_WS_URL`
   - **Value**: `wss://your-backend-api-url.onrender.com` (e.g. your Render/Railway backend address).

### Step 4: Deploy
Click **Deploy** (or your custom project name). Netlify will install the dependencies, build the React frontend, and deploy it to a `.netlify.app` domain.
