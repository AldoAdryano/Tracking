# 📍 GeoTrack — Location Tracker

A self-hosted location tracking website. Generate unique tracking links, share them, and see the GPS location of anyone who opens them — all displayed in real-time on an interactive map.

---

## 🚀 Quick Start

### Step 1 — Set Up Firebase (Free)

GeoTrack uses **Firebase Firestore** as its database. The free tier (Spark plan) is more than enough.

#### 1.1 Create a Firebase Project

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name (e.g. `geotrack`) → Continue
4. Disable Google Analytics (optional) → **Create project**

#### 1.2 Create a Firestore Database

1. In the left sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** *(allows read/write without auth — fine for personal use)*
4. Select a region close to you → **Enable**

#### 1.3 Get Your Firebase Config

1. In the left sidebar, click the **gear icon ⚙️** → **Project settings**
2. Scroll down to **"Your apps"** section
3. Click the **`</>`** (Web) icon to register a web app
4. Enter an app nickname (e.g. `geotrack-web`) → **Register app**
5. You'll see a config object like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

6. Copy these values.

---

### Step 2 — Configure GeoTrack

Open the file **`js/config.js`** and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← paste your values here
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
};
```

---

### Step 3 — Host the Website

The site is **pure HTML/CSS/JS** — no build step needed. You have several options:

#### Option A: Firebase Hosting (Recommended — Free)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, set public dir to "."
firebase deploy
```

Your site will be live at `https://your-project.web.app`

#### Option B: GitHub Pages (Free)

1. Push this folder to a GitHub repository
2. Go to **Settings → Pages**
3. Set source to **main branch / root**
4. Your site will be at `https://yourusername.github.io/repo-name`

#### Option C: Netlify / Vercel (Free)

Drag and drop the project folder at [netlify.com/drop](https://app.netlify.com/drop) for instant hosting.

#### Option D: Local (for testing only)

Use a local server (required because of browser security restrictions on `file://`):

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .

# VS Code
Install "Live Server" extension → right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

> ⚠️ **Important:** Opening `index.html` directly as a `file://` URL will NOT work due to browser CORS restrictions on Firebase SDK. Always use a local server or hosted URL.

---

## 📖 How to Use

### Creating a Tracking Link

1. Open your hosted GeoTrack dashboard (`index.html`)
2. Click **"New Tracking Link"**
3. Enter a name for the link (e.g. "Survey Form", "Job Application")
4. Click **"Create Link"**
5. A unique URL is generated — click the copy button to copy it

### Sharing the Link

Send the tracking URL to your target via:
- Email
- WhatsApp / Telegram / SMS
- Social media DM
- Embed in a webpage

The tracking page (`track.html?id=...`) looks like a **Google Drive document loading screen** — it won't raise suspicion.

### Viewing Locations

1. On the dashboard, find your tracking link
2. Click the **"View"** button
3. A map opens showing all captured locations as numbered pins
4. Click any pin or list item for details:
   - GPS coordinates (latitude/longitude)
   - Accuracy radius
   - City, region, country (from IP)
   - IP address
   - Browser/device info
   - Timestamp

---

## 🗺️ How It Works

```
User opens tracking link
        │
        ▼
track.html loads
        │
        ├─► Increments hit counter in Firestore
        │
        ├─► Fetches IP info (city, country) from ipapi.co
        │
        └─► Requests GPS location (browser prompt)
                │
                ├─ Granted → saves precise GPS coords to Firestore
                │
                └─ Denied  → saves IP-based approximate location
```

The dashboard listens to Firestore in **real-time** — locations appear instantly without refreshing.

---

## 🔒 Firestore Security Rules

For personal use, **test mode** (open read/write) is fine. For production, use these rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tracking_links/{linkId} {
      // Anyone can increment hit count and add locations (for tracking to work)
      allow read: if false;
      allow update: if request.resource.data.diff(resource.data).affectedKeys()
                       .hasOnly(['hitCount']);

      match /locations/{locId} {
        allow create: if true;
        allow read, update, delete: if false;
      }
    }
  }
}
```

---

## 📁 File Structure

```
GeoTrack/
├── index.html          ← Dashboard (your control panel)
├── track.html          ← Tracking page (the link you share)
├── css/
│   └── style.css       ← All styles
├── js/
│   ├── config.js       ← 🔑 Firebase config (edit this!)
│   ├── dashboard.js    ← Dashboard logic
│   └── tracker.js      ← Location capture logic
└── README.md           ← This file
```

---

## ⚠️ Legal & Ethical Notice

This tool is intended for **legitimate use cases** such as:
- Tracking your own devices
- Parental monitoring (with consent)
- Security research on your own systems
- Educational purposes

**Do NOT use this tool to track people without their knowledge or consent.** Unauthorized location tracking may be illegal in your jurisdiction. The developer assumes no responsibility for misuse.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 / CSS3 / Vanilla JS | Frontend |
| Firebase Firestore | Real-time database |
| Leaflet.js | Interactive maps |
| OpenStreetMap | Map tiles (free) |
| ipapi.co | IP geolocation (free) |
| Font Awesome | Icons |
