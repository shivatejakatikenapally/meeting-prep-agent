# Meeting Prep Agent 🤝

An AI-powered meeting preparation assistant that generates personalized briefing documents for upcoming meetings. It uses **Hindsight** for long-term memory and **Gemini** for intelligent brief generation.

## Features

- 📋 **Contact Management** — Browse contacts and their associated meeting history
- 🧠 **AI-Powered Briefs** — Auto-generated meeting preparation briefs using Gemini
- 💾 **Memory System** — Stores and recalls past meeting notes via Hindsight
- ⚙️ **User Preferences** — Customize how briefs are formatted
- 🐳 **Docker Support** — One-command deployment

---

## Prerequisites

- **Python 3.11+**
- **pip** (Python package manager)
- API keys (see [Environment Setup](#2-environment-setup) below)

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/shivatejakatikenapally/meeting-prep-agent.git
cd meeting-prep-agent
```

### 2. Environment Setup

Create a `backend/.env` file with the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-latest
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_API_KEY=your_hindsight_api_key_here
PORT=8000
```

> ⚠️ **Never commit your `.env` file.** Ask the team lead for the API keys.

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run the App

```bash
# From the backend/ directory
uvicorn main:app --reload --port 8000
```

The app will be available at **http://localhost:8000**

---

## Running with Docker (Alternative)

```bash
# From the project root
docker build -t meeting-prep-agent .
docker run -p 8000:8000 --env-file backend/.env meeting-prep-agent
```

---

## Project Structure

```
meeting-prep-agent/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── llm.py                # Gemini LLM integration
│   ├── hindsight_wrapper.py  # Hindsight memory API wrapper
│   ├── ingest.py             # Data ingestion utilities
│   ├── mock_data.json        # Sample contact data
│   └── requirements.txt      # Python dependencies
├── frontend/
│   ├── index.html            # Landing page
│   ├── app.html              # Main app page
│   ├── app.js                # Frontend logic
│   └── style.css             # Styles
├── Dockerfile                # Docker container config
├── implementation_plan.md    # Project planning doc
└── .gitignore
```

---

## API Endpoints

| Method | Endpoint                   | Description                           |
|--------|----------------------------|---------------------------------------|
| GET    | `/api/contacts`            | List all contacts                     |
| GET    | `/api/brief/{bank_id}`     | Generate a meeting brief for contact  |
| GET    | `/api/memory/{bank_id}`    | Retrieve stored memory for a contact  |
| POST   | `/api/ingest/{bank_id}`    | Ingest meeting notes for a contact    |
| POST   | `/api/preferences`         | Save user formatting preferences      |

---

## Tech Stack

- **Backend:** Python, FastAPI, Uvicorn
- **Frontend:** Vanilla HTML/CSS/JS
- **AI:** Google Gemini (`google-genai`)
- **Memory:** Hindsight (`hindsight-client`)
- **Containerization:** Docker

---

## Need Help?

Reach out to the team lead for API keys or if you run into setup issues.
