# 🛰️ ISS Tracker

An interactive 3D tracker for the **International Space Station**, built with Python, Dash, JavaScript, MapLibre GL, and Three.js.

The tracker retrieves the ISS's live position and visualizes it above a satellite globe, with smooth movement and an estimated orbital trajectory.

## ✨ Features

* 🌍 Interactive 3D satellite globe
* 🛰️ Realistic 3D model of the International Space Station
* 📡 Live ISS position updates
* 🎯 Smooth movement between position updates
* 🔴 Past orbital trajectory
* ⚪ Estimated future orbital trajectory
* 🌎 Satellite imagery from Esri
* 🧭 3D Earth-centered coordinate system
* 💫 Draco-compressed GLB model support
* ⚡ Real-time browser rendering with Three.js

## 📷 Screenshots:
<img width="1298" height="951" alt="image" src="https://github.com/user-attachments/assets/7b5e2beb-6d64-498c-9bc7-edba144343e7" />

<img width="1093" height="872" alt="image" src="https://github.com/user-attachments/assets/7823f320-2e94-4feb-8246-d7d9e91951d5" />



## 🛠️ Tech Stack

| Technology             | Purpose                                         |
| ---------------------- | ----------------------------------------------- |
| **Python**             | ISS data retrieval and application logic        |
| **Dash**               | Web application and client-server communication |
| **JavaScript**         | Visualization and real-time updates             |
| **MapLibre GL**        | Interactive globe and map rendering             |
| **Three.js**           | 3D ISS model and orbital visualization          |
| **Open Notify API**    | Live ISS position data                          |
| **Esri World Imagery** | Satellite imagery                               |
| **Git / GitHub**       | Version control                                 |

## 🧠 How It Works

The application is split into a few main parts.

### 1. ISS Position

Python periodically requests the ISS's current latitude and longitude from the Open Notify API.

```text
ISS API
   ↓
Python
   ↓
Dash Store
   ↓
JavaScript
```

### 2. 3D Position

The ISS's latitude and longitude are converted into Earth-centered 3D coordinates.

The tracker uses the Earth's radius together with a visually exaggerated altitude so the ISS can be clearly seen above the globe.

```text
Latitude + Longitude + Altitude
              ↓
       3D coordinates
              ↓
         Three.js
              ↓
        ISS position
```

### 3. Orbital Visualization

The tracker records recent ISS positions and estimates the orbital plane from the observed movement.

It then uses that orbital plane and an approximate 90-minute orbital period to generate:

* a past trajectory
* a predicted future trajectory

> **Note:** The predicted trajectory is an approximation for visualization. It is not intended to replace a proper orbital propagator such as SGP4 using current TLE/OMM data.

## 📁 Project Structure

```text
ISS Tracker/
├── main.py
├── README.md
└── assets/
    ├── map.mjs
    └── ISS.glb
```

## 🚀 Running Locally

### Requirements

* Python 3.10+
* Internet connection
* A modern browser

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd "ISS Tracker"
```

### 2. Install dependencies

```bash
pip install dash requests
```

### 3. Run the application

```bash
python main.py
```

Dash will provide a local URL, typically:

```text
http://127.0.0.1:8050/
```

Open it in your browser.

## 📡 Data

The application uses the **Open Notify ISS API** for live position data.

Satellite imagery is provided by **Esri World Imagery**.

The ISS 3D model is based on a NASA 3D model distributed through NASA's 3D Resources.

## 🎯 What I Learned

This project was built as a practical introduction to combining different parts of software development into one application.

Some of the concepts explored include:

* Working with REST APIs
* Parsing JSON data
* Python HTTP requests
* Dash callbacks and state
* JavaScript modules
* Browser-side application logic
* 3D coordinate systems
* Vector mathematics
* Orbital-plane calculations
* Three.js scenes and 3D models
* MapLibre custom 3D layers
* GLB/GLTF assets
* Draco-compressed 3D models
* Debugging browser and Python errors
* Git and GitHub version control
  

## 📜 License

use it lol

---

**Built by Amr**

