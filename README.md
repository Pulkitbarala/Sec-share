# 🔒 SecureShare – Encrypted File Sharing App

A full-stack, production-ready file sharing application with **AES-256-GCM client-side encryption**, built with React + Vite + Tailwind CSS and Supabase for the backend.

---

## ✨ Features

- **End-to-end encryption** – Files are encrypted in the browser using the Web Crypto API (AES-256-GCM) before upload. The server never sees plaintext data.
- **6-digit share codes** – Share files with short, easy-to-type codes.
- **QR code sharing** – Instantly generate a QR code for mobile sharing.
- **Password protection** – Optional additional password layer.
- **Download limits** – Set a maximum number of downloads.
- **Expiry timers** – Files auto-expire after a set number of hours.
- **Auto-cleanup** – Edge Function + pg_cron schedule deletes expired files automatically.
- **Secure URLs** – Files use short-lived signed URLs; the bucket is private.
- **Drag and drop upload** – Intuitive file drop zone.
- **Progress tracking** – Visual progress bar for encrypt + upload stages.
- **Responsive UI** – Dark glassmorphism design, mobile-friendly.
- **AdSense placeholders** – Ready for monetization.

---

## 📁 Project Structure

```
file-sharing/
├── index.html
├── vite.config.js
├── .env.example
├── package.json
├── supabase/
│   ├── migrations/
│   │   └── 001_create_files.sql        <- DB schema + RLS + RPC
│   └── functions/
│       └── cleanup-files/
│           └── index.ts                <- Edge Function (auto-cleanup)
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── Navbar.jsx
    │   ├── ProtectedRoute.jsx
    │   ├── ProgressBar.jsx
    │   ├── CountdownTimer.jsx
    │   ├── CopyButton.jsx
    │   ├── AdPlaceholder.jsx
    │   └── Toast.jsx
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── Share.jsx
    │   ├── Download.jsx
    │   ├── PrivacyPolicy.jsx
    │   └── TermsOfService.jsx
    └── utils/
        ├── supabase.js
        ├── crypto.js
        └── formatters.js
```

---

## 🚀 Setup Instructions

### Step 1 – Create a Supabase Project

1. Go to https://app.supabase.com and click **New Project**.
2. Choose a name, region, and strong database password. Click **Create Project**.
3. Wait ~2 minutes for the project to initialize.

### Step 2 – Set Up the Database

1. In the Supabase Dashboard, go to **SQL Editor -> New Query**.
2. Paste the entire contents of `supabase/migrations/001_create_files.sql`.
3. Click **Run**. You should see a success message.

### Step 3 – Create the Storage Bucket

1. Go to **Storage** in the left sidebar.
2. Click **New Bucket**.
3. Name it exactly: `secure_files`
4. Set it to **Private** (do NOT enable public access).
5. Click **Create Bucket**.

### Step 4 – Get Your API Keys

1. Go to **Project Settings -> API**.
2. Copy:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (the `eyJh...` JWT)

### Step 5 – Configure Environment Variables

```bash
copy .env.example .env
```

Then edit `.env`:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 6 – Run the App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

---

## 🧹 Auto-Cleanup Setup

### Option A – Edge Functions + pg_cron (Recommended)

1. Install Supabase CLI: `npm install -g supabase`
2. Login and link: `supabase login && supabase link --project-ref your-project-id`
3. Deploy: `supabase functions deploy cleanup-files`
4. Set secret: `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`

Then schedule it in SQL Editor:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cleanup-expired-files',
  '0 * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_PROJECT_ID.supabase.co/functions/v1/cleanup-files',
      headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
    );
  $$
);
```

---

## 🔐 Encryption Details

| Property | Value |
|---|---|
| Algorithm | AES-256-GCM |
| Key derivation | PBKDF2 (SHA-256, 310,000 iterations) |
| Salt | 16 bytes (random per file) |
| IV | 12 bytes (random per file) |
| Packed format | [salt(16) or iv(12) or ciphertext] |
| Key leaves browser | Never |

---

## 🛡️ Security Notes

- Files are uploaded as encrypted blobs — the server cannot read them.
- The `secure_files` storage bucket is **private** — no public URLs exist.
- Files are served via **short-lived signed URLs** (30-second validity).
- Passwords are hashed with SHA-256 for verification.
- RLS ensures users can only access their own file metadata.
- `record_download` RPC uses `FOR UPDATE` row locking to prevent race conditions.

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Icons | Lucide React |
| QR Codes | qrcode.react |
| Auth | Supabase Auth (Email/Password) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage (Private) |
| Edge Functions | Supabase Deno Edge Runtime |
| Encryption | Web Crypto API (AES-256-GCM) |

---

## 🏗️ Build for Production

```bash
npm run build
```

Output is in the `dist/` folder. Deploy to Vercel, Netlify, or any static host.
