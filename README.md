🛡️ Argus — Real-Time Public Safety Analytics
Argus is an AI-powered real-time public safety surveillance system designed to detect distress situations from CCTV feeds and automatically alert authorities.

Built during a 24-hour national-level hackathon.



🚨 Problem Statement
Existing CCTV systems are passive — they record incidents but do not respond in real time.

In critical situations like stalking, harassment, or assault, every second matters.

Argus transforms passive CCTV infrastructure into an intelligent, real-time threat detection system focused on women’s safety in public spaces.



🎯 Our Solution
Argus connects to live camera feeds and uses AI-based spatial and motion analysis to detect high-risk distress scenarios.

When suspicious activity is detected, the system:

✅ Classifies threat level
✅ Generates real-time alert
✅ Sends notification to dashboard
✅ Logs incident with timestamp and confidence


🧠 Core Features 
1️⃣ Encirclement Detection
Detects when:

One person is surrounded by 3 or more individuals
Movement becomes restricted
Proximity threshold maintained across frames
Use case: Group intimidation / harassment scenario.

2️⃣ Following / Pursuit Detection
Detects when:

One individual consistently follows another
Maintains close distance
Mirrors directional changes
Use case: Stalking detection.

3️⃣ Physical Struggle Detection
Detects when:

Two individuals are in very close proximity
Bounding boxes overlap significantly
Rapid erratic movement occurs
Use case: Assault detection.



🏗️ System Architecture
text

Video Feed
    ↓
YOLOv8 Person Detection & Tracking
    ↓
Distress Detection Engine
    ↓
Alert Manager
    ↓
WebSocket Broadcast
    ↓
Live Dashboard


⚙️ Tech Stack

AI & Computer Vision
Ultralytics YOLOv8 (person detection & tracking)
OpenCV (video processing)
Backend
FastAPI
WebSockets
Frontend
Next.js
TailwindCSS
Leaflet.js (map view)
Optional AI Verification
Gemini Vision API (scene validation)


📁 Project Structure

Argus/
│
├── backend/
│   ├── main.py
│   ├── core/
│   │   ├── yolo_tracker.py
│   │   ├── distress_engine.py
│   │   └── video_processor.py
│   ├── alerts/
│   └── api/
│
├── frontend/
│   ├── app/
│   ├── components/
│
├── assets/
│   └── demo_videos/
│
└── README.md


🚀 How to Run

Backend

1️⃣ Install backend dependencies

`pip install -r requirements.txt`

2️⃣ Start FastAPI from the repo root

`uvicorn backend.main:app --reload`

Frontend

1️⃣ Install frontend dependencies

`cd frontend/Argus2.0/ASSETS/argus-smart-surveillance && npm install`

2️⃣ Start the Vite app during development

`npm run dev`

The Vite dev server now proxies `/api` and `/ws` to the FastAPI app on `http://127.0.0.1:8000`.

Single-app build

1️⃣ Build the frontend

`cd frontend/Argus2.0/ASSETS/argus-smart-surveillance && npm run build`

2️⃣ Start FastAPI again

`uvicorn backend.main:app --reload`

FastAPI will automatically serve the built frontend from the generated `dist/` folder.

### 🛡️ Supabase Setup (Important)
To ensure the dashboard works correctly, please configure your Supabase project:
1. **Tables**: Create an `incidents` table (see `backend/models/incident.py` for schema).
2. **RLS Policies**: In the Supabase dashboard, set the `incidents` table policy to **"Enable access for all users"** for `SELECT`, `INSERT`, and `UPDATE` (since we use the `anon` key).
3. **Storage**: Create a public bucket named **`incidents`** for evidence screenshots.
🎥 Running Video Detection
The system supports:

✅ Webcam
✅ IP Camera (RTSP)
✅ Pre-recorded video 


Example:

Python

tracker = YOLOTracker("backend/sample_videos/incident.mp4")
tracker.run()
📊 Dashboard Pages
/ → Live Camera Feed + Active Alerts
/incidents → Incident History
/map → Camera Location Map
🔒 Privacy & Design Philosophy
No facial recognition used
No identity storage
Focus on behavioral and spatial risk detection
Designed to integrate with existing CCTV infrastructure
🧩 Why Argus?
✅ Real-time detection
✅ No new hardware required
✅ AI-assisted decision support
✅ Scalable to smart city infrastructure
✅ Designed specifically for women safety escalation scenarios

📈 Future Improvements

Multi-camera distributed processing
Crowd behavior modeling
Facial distress signal modeling (high-resolution feeds)
Integration with emergency dispatch systems
Mobile officer app
🤝 Open-Source & AI Disclosure
This project uses:

Ultralytics YOLOv8 (pretrained model)

OpenCV
FastAPI
Next.js
AI coding assistance tools during development
All integration and system logic were implemented during the hackathon period.

👥 Team

Built by Team Code Cruzers

Team members:
Shresth Kumar
Rohit Shukla
Syed Hussain

🛡️ Tagline
“From Passive Surveillance to Proactive Protection.”
