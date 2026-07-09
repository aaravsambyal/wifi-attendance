<div align="center">
   <h1> WiFi Attendance 📡 </h1>

   <img src="https://img.shields.io/badge/Bootstrap-7952B3?style=for-the-badge" />
   <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge" />
   <img src="https://img.shields.io/badge/Express-61DAFB?style=for-the-badge" />
   <img src="https://img.shields.io/badge/EJS-8BC0D0?style=for-the-badge" />
   <img src="https://img.shields.io/badge/JWT-FD7D24?style=for-the-badge" />
   <img src="https://img.shields.io/badge/Bcrypt-003A70?style=for-the-badge" />
   <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge" />
   <img src="https://img.shields.io/badge/WiFi--Attendance-System-blue?style=for-the-badge" />
</div>

## 📌 Overview

**WiFi Attendance** is a full-stack Node.js web application that automates meeting attendance tracking by verifying participants are connected to the **same WiFi network** as the meeting host. It includes QR code fallback for joining, live polling/voting, PDF report generation, and an admin dashboard — all backed by a self-contained file-based database.

## 🎯 Objectives

- Automatically mark attendance by detecting shared WiFi network presence.
  Provide a QR-based fallback for participants unable to join via WiFi.
  Enable hosts to create real-time polls during meetings.
  Generate downloadable PDF reports with attendance logs and poll results.

## 🛠 Features

- **WiFi-Based Attendance:** Detects the host's local network IP and validates participants are on the same subnet.
- **QR Code Fallback:** Inline QR codes for quick mobile joining.
- **Live Polling:** Hosts can create polls; participants vote in real-time with live-updating results.
- **PDF Reports:** Client-side PDF generation (via jsPDF) with attendee tables and poll summaries.
- **Join/Leave Tracking:** Full attendance log with timestamps for each join and leave event.
- **Meeting Management:** Create, join, end, and delete meetings with persistent storage.
- **Authentication:** JWT-based login/signup with bcrypt password hashing.
- **Dark/Light Theme:** Material Design 3 inspired UI with persistent theme toggle.
- **Docker Support:** Ready-to-deploy with Docker and docker-compose.

## 🎨 Color Palette Reference (Material Theme)

| Theme                | Background                                                                                                         | Foreground                                              | Primary / Accents                                                                                                                                                             | Status                                                                                                                                                                        |
| :------------------- | :----------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Material Darker**  | ![#121212](https://img.shields.io/badge/-121212-121212)<br>![#1E1E1E](https://img.shields.io/badge/-1E1E1E-1E1E1E) | ![#E3E3E3](https://img.shields.io/badge/-E3E3E3-E3E3E3) | ![#C5CAE9](https://img.shields.io/badge/-C5CAE9-C5CAE9)<br>![#3949AB](https://img.shields.io/badge/-3949AB-3949AB)<br>![#8C9EFF](https://img.shields.io/badge/-8C9EFF-8C9EFF) | ![#50fa7b](https://img.shields.io/badge/-50fa7b-50fa7b)<br>![#ffb86c](https://img.shields.io/badge/-ffb86c-ffb86c)<br>![#FF5252](https://img.shields.io/badge/-FF5252-FF5252) |
| **Material Lighter** | ![#FCFCFC](https://img.shields.io/badge/-FCFCFC-FCFCFC)<br>![#FFFFFF](https://img.shields.io/badge/-FFFFFF-FFFFFF) | ![#212121](https://img.shields.io/badge/-212121-212121) | ![#1A237E](https://img.shields.io/badge/-1A237E-1A237E)<br>![#E8EAF6](https://img.shields.io/badge/-E8EAF6-E8EAF6)<br>![#3F51B5](https://img.shields.io/badge/-3F51B5-3F51B5) | ![#50fa7b](https://img.shields.io/badge/-50fa7b-50fa7b)<br>![#ffb86c](https://img.shields.io/badge/-ffb86c-ffb86c)<br>![#FF5252](https://img.shields.io/badge/-FF5252-FF5252) |

## 📂 Project Structure

```text
.
├── data/                       # Persistent JSON storage (users, meetings)
├── lib/
│   └── mongoose-mock.js        # File-based MongoDB mock
├── middleware/
│   └── auth.js                 # JWT authentication & admin middleware
├── models/
│   ├── User.js                 # User schema (username, password, role)
│   ├── Meeting.js              # Meeting schema (title, host, IP, active)
│   ├── Attendance.js           # Attendance schema (user, meeting, logs)
│   └── Poll.js                 # Poll schema (question, options, votes)
├── public/                     # Public assets (CSS, JS, images)
├── results/                    # UI screenshots and demo video
├── template/                   # EJS templates
├── views/
│   ├── partials/
│   │   └── header.ejs          # Shared head, nav bar, theme toggle
│   ├── dashboard.ejs           # Main dashboard (create/join/list meetings)
│   ├── meeting_room.ejs        # Meeting room (attendance, polls, QR)
│   ├── login.ejs               # Login page
│   ├── signup.ejs              # Signup page
│   └── qr.ejs                  # Full-page QR display
├── Dockerfile                  # Docker build (node:18-alpine)
├── docker-compose.yml          # Docker Compose configuration
├── package.json                # Project dependencies & metadata
├── server.js                   # Express server + all route logic
└── README.md                   # Documentation
```

## 🚀 Working

1. **Authentication**  
   Users sign up and log in. Passwords are hashed with bcrypt; sessions are managed via JWT tokens stored in httpOnly cookies.

2. **Meeting Creation**  
   Hosts create a meeting room. The app auto-detects the host's network IP using OS network interfaces.

3. **WiFi Verification [`server.js`](server.js)**  
   Participants join by meeting ID. The server compares client IPs — if both are on the same subnet (matching first 3 octets or both private), attendance is recorded.

4. **QR Code Fallback [`server.js`](server.js)**  
   The meeting room displays a QR code encoding the join URL. Scanning it opens the join page on mobile devices.

5. **Live Polling [`server.js`](server.js)**  
   Hosts can create polls with multiple options. Participants vote once per poll; results update via 5-second polling.

6. **PDF Reports**  
   After ending a meeting, hosts can download a PDF report (generated client-side with jsPDF) containing the attendance log and poll results.

## ⚙️ Installation & Usage

### 1 Clone the repository

[![Git](https://img.shields.io/badge/Git-F05032?style=plastic&logo=git&logoColor=white)](https://git-scm.com/downloads)
[![Project](https://img.shields.io/badge/Project-Repository-blue?style=plastic&logo=github&logoColor=white)](https://github.com/akshat-jasrotia/wifi-attendance)

```bash
git clone https://github.com/yourusername/wifi-attendance.git
cd wifi-attendance
```

### 2 Install dependencies

[![Node.js](https://img.shields.io/badge/Node.js-339933?style=plastic&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

```bash
npm install
```

### 3 Run the application

```bash
npm run dev
```

Open your browser and visit: `http://localhost:3000`

### Or Run with Docker

[![Docker](https://img.shields.io/badge/Docker-2496ED?style=plastic&logo=docker&logoColor=white)](https://docker.com/)
[![Image](https://img.shields.io/badge/Image-Repository-0005F5?style=plastic&logo=docker&logoColor=white)](https://hub.docker.com/r/akshatjasrotia/wifi-attendance)

#### Pull from Docker Hub

```bash
docker pull akshatjasrotia/wifi-attendance
docker run -p 3000:3000 akshatjasrotia/wifi-attendance
```

#### Or Run Docker locally

```bash
docker-compose up --build
```

## 📽️ Visuals & Results

### 🔐 Login & Registration Pages

<table width="100%">
  <tr>
    <th width="50%">🔓  Login (Light / Dark)</th>
    <th width="50%">📝  Registration (Light / Dark)</th>
  </tr>
  <tr>
    <td><img src="results/login_light.png" alt="Login Light" width="100%" height="250"/></td>
    <td><img src="results/register_light.png" alt="Register Light" width="100%" height="250"/></td>
  </tr>
  <tr>
    <td><img src="results/login_dark.png" alt="Login Dark" width="100%" height="250"/></td>
    <td><img src="results/register_dark.png" alt="Register Dark" width="100%" height="250"/></td>
  </tr>
</table>

### 📊 Dashboard

<table width="100%">
  <tr>
    <th width="50%">💼 Host Dashboard (Light / Dark)</th>
    <th width="50%">👥 Attendee Dashboard (Light / Dark)</th>
  </tr>
  <tr>
    <td>
      <img src="results/host_dashboard_light.png" alt="Host Dashboard Light" width="100%" height="300"/>
      <hr/>
      <img src="results/host_dashboard_dark.png" alt="Host Dashboard Dark" width="100%" height="300"/>
    </td>
    <td>
      <img src="results/attendee_dashboard_light.png" alt="Attendee Dashboard Light" width="100%" height="300"/>
      <hr/>
      <img src="results/attendee_dashboard_dark.png" alt="Attendee Dashboard Dark" width="100%" height="300"/>
    </td>
  </tr>
</table>

### 🏠 Meeting Room & Live Polling

<table width="100%">
  <tr>
    <th width="50%">👑 Host Live Meeting (Light / Dark)</th>
    <th width="50%">🙋 Attendee Live Meeting (Light / Dark)</th>
  </tr>
  <tr>
    <td>
      <img src="results/host_live_meeting_light.png" alt="Host Live Meeting Light" width="100%" height="300"/>
      <hr/>
      <img src="results/host_live_meeting_dark.png" alt="Host Live Meeting Dark" width="100%" height="300"/>
    </td>
    <td>
      <img src="results/attendee_live_meeting_light.png" alt="Attendee Live Meeting Light" width="100%" height="300"/>
      <hr/>
      <img src="results/attendee_live_meeting_dark.png" alt="Attendee Live Meeting Dark" width="100%" height="300"/>
    </td>
  </tr>
</table>

### 📄 Meeting End

<table width="100%">
  <tr>
    <th width="50%">📊 Host Meeting End (Light / Dark)</th>
    <th width="50%">🛑 Attendee Meeting End (Light / Dark)</th>
  </tr>
  <tr>
    <td>
      <img src="results/host_meeting_end_light.png" alt="Host Meeting End Light" width="100%" height="300"/>
      <hr/>
      <img src="results/host_meeting_end_dark.png" alt="Host Meeting End Dark" width="100%" height="300"/>
    </td>
    <td>
      <img src="results/attendee_meeting_end_light.png" alt="Attendee Meeting End Light" width="100%" height="300"/>
      <hr/>
      <img src="results/attendee_meeting_end_dark.png" alt="Attendee Meeting End Dark" width="100%" height="300"/>
    </td>
  </tr>
</table>

### 🎥 Demo Video

[results/video.mp4](results/video.mp4)

## 🔮 Future Improvements

> Input sanitization, rate limiting, and security hardening

## ☁️ Deployment

[![Railway](https://img.shields.io/badge/Railway-000000?style=plastic&logo=railway&logoColor=white)](https://railway.app)
[![Site](https://img.shields.io/badge/Site-URL-000000?style=plastic&logo=railway&logoColor=white)](https://wifi-attendance.up.railway.app/)

**Method A — Native Node.js:**

1. Sign in to Railway and click **New Project > Deploy from GitHub**.
2. Select your repository.
3. Railway automatically detects the Node.js project, runs `npm install`, and starts the server using your `package.json`'s start script.
4. Go to **Settings > Generate Domain** to get a public URL.

**Method B — Docker:**

1. Click **New Project** on Railway.
2. Select **Deploy from GitHub** and connect your repository.
3. Railway scans the repository, detects the `Dockerfile`, and automatically builds the image.
4. Go to **Settings** and click **Generate Domain** to access your containerized deployment.

## 👤 Author

[![Email](https://img.shields.io/badge/Email-D14836?style=plastic)](mailto:akshatjasrotia85@gmail.com)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=plastic)](https://youtube.com/@akshatjasrotia)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=plastic)](https://https://github.com/akshat-jasrotia)
