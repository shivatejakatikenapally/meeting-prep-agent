# Meeting Prep Agent - Implementation Plan

This plan safely layers new features on top of your existing codebase without disrupting the current functionality.

## Phase 1: Stability & Error Handling (Quick Wins)
**Goal:** Prevent the silent UI freezing that occurs when the LLM returns invalid JSON or takes too long.
*   **Frontend (`frontend/app.js`):** 
    *   Wrap `fetch` calls in `loadBrief()` and `loadMemory()` with `try/catch` blocks.
    *   If an error occurs, update the DOM to display a clean error message (e.g., *"Failed to generate brief. The AI might have hiccuped. [Try Again]"*) instead of remaining stuck on "Thinking...".
*   **Backend (`backend/main.py`):**
    *   No changes needed; FastAPI already returns a 500 error which the new frontend logic will catch gracefully.

## Phase 2: Learning User Preferences
**Goal:** Fulfill the problem statement's requirement to *"Learn your meeting style and preparation preferences."*
*   **Backend (`backend/hindsight_wrapper.py` & `main.py`):**
    *   Create a new POST endpoint `/api/feedback` that takes user instructions (e.g., "Make TL;DR shorter") and saves it to Hindsight using a dedicated `bank_id` (e.g., `user_preferences_bank`).
    *   Update the `/api/brief/{bank_id}` endpoint to query this `user_preferences_bank` first to retrieve the user's saved formatting rules.
*   **Backend (`backend/llm.py`):**
    *   Update `BRIEF_PROMPT` to include a new section: `User Preferences: {user_preferences}`.
*   **Frontend (`frontend/app.html` & `app.js`):**
    *   Add a small feedback input box and "Submit" button at the bottom of the Briefing tab.
    *   Wire the button to hit the `/api/feedback` endpoint and immediately regenerate the brief.

## Phase 3: The "Learning Curve" Ingestion Loop (For the Demo)
**Goal:** Show the judges a live demonstration of the agent getting smarter over time.
*   **Backend (`backend/main.py`):**
    *   Add a new POST endpoint `/api/ingest/{bank_id}`.
    *   This endpoint will receive a text payload (a meeting transcript or notes) and call the existing `retain_meeting` function in `hindsight_wrapper.py` to store the new memory.
*   **Frontend (`frontend/app.html` & `app.js`):**
    *   Add an "Add Meeting Notes" section in the UI (perhaps as a new tab or a side panel).
    *   Provide a dropdown to select a mock meeting transcript from `mock_data.json` (Meeting 1, Meeting 2, etc.) or paste custom text.
    *   When submitted, send the text to `/api/ingest/{bank_id}`, then automatically refresh the Briefing tab so the judges can literally watch the brief evolve from generic to highly personalized.

## Phase 4: Data Expansion
**Goal:** Prove the agent works across different scenarios.
*   **Data (`backend/mock_data.json`):**
    *   Add 2-3 completely new contacts with different personas (e.g., a technical founder who cares about API limits, a marketing executive who cares about brand alignment).
    *   *(Note: You will need to ingest these into your Hindsight cloud instance before the demo).*
