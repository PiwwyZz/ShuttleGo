# 🚐 ShuttleGo — The Clev Riverline

Real-time shuttle tracking, seat booking, and community chat for **The Clev Riverline** condominium residents (168/1 — 168/600).

![Version](https://img.shields.io/badge/version-2.0.0-black)
![Firebase](https://img.shields.io/badge/database-Firebase_RTDB-orange)
![License](https://img.shields.io/badge/license-Private-red)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🗺️ **Live Map** | Real-time shuttle GPS tracking on an interactive Leaflet map with OSRM road routing |
| 📅 **Seat Booking** | Reserve seats with time selection, pickup stop, and booking confirmation with REF code |
| 💬 **Community Chat** | Real-time group chat with role badges (Driver/Admin/Resident) |
| 📡 **Driver GPS** | High-accuracy GPS broadcasting with speed, accuracy, and navigation target |
| 🔐 **Resident Database** | 600 rooms (168/1–168/600), each with a unique 6-character password |
| 📊 **Login & Usage Logs** | Every login attempt and key action is logged with timestamps |
| 🏠 **Admin Panel** | Stats dashboard, session viewer, resident lookup, log viewer, system controls |
| 🌐 **Bilingual** | Full English / Thai (ภาษาไทย) localization |
| 🌙 **Dark Mode** | System-aware dark theme with manual toggle |
| 🔔 **Shuttle Alerts** | Browser notification when shuttle approaches your booked pickup stop |

---

## 🏗️ Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript (ES Modules)
- **Database:** [Firebase Realtime Database](https://firebase.google.com/docs/database)
- **Map:** [Leaflet.js](https://leafletjs.com/) + [CartoDB](https://carto.com/basemaps) tiles
- **Routing:** [OSRM](http://project-osrm.org/) (Open Source Routing Machine)
- **Fonts:** [Inter](https://fonts.google.com/specimen/Inter) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono)
- **Hosting:** Any static file server / GitHub Pages / Firebase Hosting

---

## 📁 Project Structure

```
ShuttleGo/
├── index.html      # Main app — login, map, booking, chat, driver, admin, settings
├── app.js          # All application logic (Firebase, GPS, booking, chat, auth, logging)
├── style.css       # Complete design system with dark mode, animations, responsive layout
└── README.md       # This file
```

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/PiwwyZz/ShuttleGo.git
cd ShuttleGo
```

### 2. Run locally
Any static HTTP server works:
```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code
# Use the "Live Server" extension
```

### 3. Open in browser
```
http://localhost:8080
```

> ⚠️ **GPS broadcasting requires HTTPS** in most browsers. For local dev, `localhost` is fine.

---

## 🔑 Login Credentials

### Default Accounts

| Role | Username | Password | Access |
|------|----------|----------|--------|
| **Admin** | `admin` | `admin1234` | Full access — dashboard, logs, system controls |
| **Driver** | `driver` | `driver1234` | GPS broadcasting, navigation, passenger manifest |

### Residents (168/1 — 168/600)

Each room has a **unique 6-character password** stored in Firebase.

- **Username:** `168/1`, `168/2`, ... `168/600`
- **Password:** Unique per room (e.g. `A7K9P2`)

#### First-Time Setup
1. Login as **admin**
2. Go to **Admin** tab → **Resident Database** card
3. Click **"Initialize Database (600 Rooms)"**
4. This creates all 600 resident accounts with unique passwords
5. Use the **Look Up Room Password** search to find any room's password

---

## 🗄️ Firebase Database Schema

```
Firebase RTDB
├── residents/
│   ├── 168_1/           # Room 168/1
│   │   ├── room: "168/1"
│   │   ├── password: "A7K9P2"
│   │   └── createdAt: 1713100000000
│   ├── 168_2/
│   └── ... (168_600)
│
├── shuttle/
│   ├── lat, lng         # Current GPS position
│   ├── speed, accuracy  # GPS metadata
│   ├── timestamp        # Last update time
│   └── active           # Broadcasting status
│
├── bookings/
│   └── {booking_id}/
│       ├── name, seats, time, pickup, ref
│
├── chats/
│   └── {message_id}/
│       ├── text, name, uid, role, time, timestamp
│
├── sessions/
│   └── {user_id}/
│       ├── uid, role, displayName, loginAt, lastSeen
│
└── logs/
    ├── login/
    │   └── {log_id}/
    │       ├── room, role, success, timestamp, userAgent, reason
    └── usage/
        └── {log_id}/
            ├── room, action, timestamp, detail
```

---

## 🛣️ Route & Stops

| # | Stop | Coordinates |
|---|------|-------------|
| 1 | 🏠 เดอะ เคลฟ ริเวอร์ไลน์ เจ้าพระยา - วงศ์สว่าง | 13.8236, 100.5046 |
| 2 | 🏫 โรงเรียนโยธินบูรณะ | 13.8144, 100.5208 |
| 3 | 🎓 มหาวิทยาลัยพระจอมเกล้าพระนครเหนือ | 13.8191, 100.5141 |
| 4 | 🛒 ตลาดศรีเขมา | 13.8150, 100.5217 |
| 5 | 🚇 MRT บางโพ | 13.8067, 100.5214 |
| 6 | ⚓ ท่าเรือบางโพ | 13.8066, 100.5191 |

### Schedule
```
06:00  07:00  08:00  09:00  10:00  11:00
13:00  14:00  15:00  16:00  17:00  18:00  19:00  19:30
```

---

## 📊 Logging System

### Login Log
Every login attempt is recorded:
- ✅ Successful logins (room, role, timestamp)
- ❌ Failed attempts (reason: `wrong_password`, `invalid_room_format`, `room_not_in_db`, `network_error`)
- User agent string for device identification

### Usage Log
Key actions are tracked:
| Action | When |
|--------|------|
| `booking_create` | Resident books a seat |
| `booking_cancel` | Resident cancels booking |
| `chat_send` | Any user sends a chat message |
| `gps_start` | Driver starts GPS broadcasting |
| `gps_stop` | Driver stops GPS broadcasting |
| `logout` | Any user signs out |
| `db_init` | Admin initializes the resident database |

---

## 🎨 Design System

- **Typography:** Inter (UI) + JetBrains Mono (data/code)
- **Colors:** Monochrome primary with Apple-style accent colors
- **Animations:** 15+ custom keyframe animations (fadeUp, scaleIn, pulse, shimmer, etc.)
- **Layout:** Mobile-first responsive, max-width 540px content area
- **Dark Mode:** Full CSS variable theme swap with system preference detection
- **Glassmorphism:** Backdrop blur on navbar, bottom nav, toasts

---

## 👤 Engineered By

**Supakorn Kheiwchaoum**

---

## 📝 License

Private — The Clev Riverline internal use only.
