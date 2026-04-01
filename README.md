# PlanForm.AI

**PlanForm.AI** is a structural intelligence platform that transforms floor plan images into actionable engineering insights. Upload a blueprint — the system detects walls, rooms, doors, and windows; constructs a 3D model; recommends construction materials; and delivers AI-generated explanations for every decision. Results can optionally be registered on the Stellar blockchain for immutable record-keeping.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Services](#running-the-services)
- [Environment Variables](#environment-variables)
- [Pipeline Overview](#pipeline-overview)
- [Blockchain Integration](#blockchain-integration)
- [Smart Contract Deployment](#smart-contract-deployment)
- [API Reference](#api-reference)

---

## Features

| Feature                           | Description                                                                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Floor Plan Parsing**            | OpenCV-based wall extraction, door/window detection, and coordinate overlay generation              |
| **Graph-Based Spatial Reasoning** | Wall segments modelled as a graph; gap detection finds openings between collinear segments          |
| **3D Model Viewer**               | Interactive Three.js scene with extruded walls, door leaves, window panels, and per-wall labels     |
| **Material Recommendations**      | Scoring engine evaluates ~100 materials against span, load type, cost, strength, and durability     |
| **AI Explanation & Chat**         | Groq LLM generates plain-English project summaries and answers follow-up questions in a chat widget |
| **Blockchain Registry**           | Soroban smart contract on Stellar Testnet stores a hashed record of every analysis                  |
| **Coordinate Overlay**            | Annotated image with wall endpoints marked, saved alongside the original for cross-referencing      |

---

## Architecture

```
Browser (React + Vite)
        │
        │  REST (multipart / JSON)
        ▼
Node.js / Express  ──────────────────────────────┐
  • Multer file upload                            │
  • Structural classifier                         │  Groq API
  • Material scoring engine          ─────────────┘  (LLM)
        │
        │  HTTP (multipart)
        ▼
Python / FastAPI  (cv-service)
  • OpenCV wall detection
  • Door / window symbol recognition
  • Graph gap analysis
  • Coordinate overlay image
        │
        │  (results returned to Node)
        ▼
Browser renders:
  LayoutViewer · ModelViewer · MaterialPanel
  TradeOff · ExplanationPanel · ChatbotWidget
  BlueprintRegistry (Stellar / Freighter)
```

---

## Tech Stack

**Frontend**

- React 19, Vite 8, Tailwind CSS
- Three.js via `@react-three/fiber` + `@react-three/drei`
- Framer Motion, React Parallax Tilt
- Stellar SDK + Freighter API

**Backend (Node.js)**

- Express 5, Multer
- Groq SDK (`llama-3.3-70b-versatile` with `llama3-8b-8192` fallback)
- Axios

**CV Service (Python)**

- FastAPI + Uvicorn
- OpenCV, NumPy, Pillow, scikit-image

**Blockchain**

- Stellar Testnet, Soroban smart contracts (Rust)
- Freighter browser wallet

---

## Project Structure

```
PlanForm.AI/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # LayoutViewer, ModelViewer, MaterialPanel, etc.
│       ├── pages/           # HomePage, UploadPage, ResultsPage, AboutUs
│       └── services/        # api.js, stellar.js
├── server/                  # Node.js Express API
│   ├── controllers/         # pipelineController.js
│   ├── services/            # aiService.js, cvService.js, materialService.js
│   ├── utils/               # scoring.js, structureClassifier.js
│   └── config/              # multer.js, config.js
├── cv-service/              # Python FastAPI CV service
│   ├── app.py
│   └── parser/
│       ├── preprocess.py    # Full CV pipeline
│       └── graph_utils.py   # Wall graph + opening detection
├── smart-contract/          # Soroban / Rust smart contract
│   └── contracts/blueprint_registry/src/lib.rs
├── data/
│   └── materials.json       # ~100-entry material catalog
├── deploy-contract.sh       # Linux/macOS deployment script
└── deploy-contract.ps1      # Windows deployment script
```

---

## Getting Started

### Prerequisites

| Tool         | Version                                       |
| ------------ | --------------------------------------------- |
| Node.js      | LTS (≥ 20)                                    |
| Python       | 3.10+                                         |
| pip          | Latest                                        |
| Rust + Cargo | Latest stable                                 |
| Stellar CLI  | Latest (`cargo install --locked stellar-cli`) |

### Installation

**1. Clone the repo**

```bash
git clone https://github.com/your-org/planform-ai.git
cd planform-ai
```

**2. Install server dependencies**

```bash
cd server && npm install
```

**3. Install client dependencies**

```bash
cd ../client && npm install
```

**4. Install Python CV service dependencies**

```bash
cd ../cv-service
pip install -r requirements.txt
```

### Running the Services

Open three terminals and run each service:

```bash
# Terminal 1 — CV service (port 8000)
cd cv-service
uvicorn app:app --reload --port 8000

# Terminal 2 — Node API server (port 5000)
cd server
npm run dev

# Terminal 3 — React frontend (port 5173)
cd client
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

Create `server/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
PORT=5000
```

Create `client/.env` (populated automatically after contract deployment):

```env
VITE_CONTRACT_ID=your_soroban_contract_id
VITE_STELLAR_NETWORK=testnet
```

---

## Pipeline Overview

When a floor plan is uploaded the following steps run in sequence:

1. **Upload** — Multer saves the image; Node forwards it to the CV service.
2. **CV Parsing** — OpenCV thresholds the image, estimates wall thickness, separates thick (wall) and thin (annotation) layers, runs Hough line detection, merges parallel edge pairs into centerlines, and snaps junctions.
3. **Symbol Detection** — Door arcs are found from quarter-circle connected components; windows from hollow-box contours or parallel thin-line pairs.
4. **Gap Classification** — Raw wall gaps are labelled `door`, `window`, or `opening` using proximity to detected symbols and outer-band heuristics.
5. **Graph Construction** — Wall segments become graph edges carrying stable `wall_id` strings (e.g. `W-03`).
6. **Structural Classification** — Server converts pixel span to metres and assigns element types: `partition_wall`, `load_bearing_wall`, `long_span`, `beam`, `slab`, `column`.
7. **Material Scoring** — Each element type selects candidates from `data/materials.json` and ranks them using weighted scores across cost, strength, durability, and thermal efficiency.
8. **AI Explanation** — Groq generates a plain-English summary covering project overview, element-wise rationale, and key trade-offs.
9. **Response** — Everything is returned to the React client for rendering.

---

## Blockchain Integration

Registering a blueprint on Stellar:

1. Connect your **Freighter** wallet (must be set to Testnet).
2. If your balance is below 1 XLM, click **Fund (Testnet)** to use Friendbot.
3. Click **Store Blueprint on Blockchain** — the app hashes the material recommendations (SHA-256) and calls `register_blueprint` on the Soroban contract.
4. After confirmation you receive a **blueprint ID** and a link to the Stellar block explorer.

The contract stores: project name, owner address, cost estimate, materials hash, room count, total area, and timestamp.

---

## Smart Contract Deployment

**Linux / macOS**

```bash
chmod +x deploy-contract.sh
./deploy-contract.sh
```

**Windows (PowerShell)**

```powershell
.\deploy-contract.ps1
```

Both scripts will:

- Build the Rust contract to WASM
- Create a `deployer` Stellar identity if one does not exist
- Fund the account via Friendbot
- Deploy the contract to Testnet
- Write `VITE_CONTRACT_ID=...` to `client/.env`
- Call `initialize` on the deployed contract

---

## API Reference

### `POST /api/pipeline/analyze`

Accepts a `multipart/form-data` request with a `floorPlan` image file.

**Response**

```json
{
  "success": true,
  "parsedLayout": { "walls": 28, "rooms": 7, "wallSegments": [...], ... },
  "structuralElements": [...],
  "recommendations": [...],
  "aiExplanation": "..."
}
```

### `POST /api/pipeline/chat`

```json
{
  "message": "Why was RCC chosen for the load-bearing walls?",
  "aiExplanation": "...",
  "recommendations": [...],
  "parsedLayout": { ... },
  "chatHistory": [...]
}
```

**Response**

```json
{
  "success": true,
  "reply": "RCC was selected because..."
}
```
