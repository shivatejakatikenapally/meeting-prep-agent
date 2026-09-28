import os, json
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uuid
from hindsight_wrapper import recall_for_contact, reflect_for_contact, retain_meeting
from llm import build_brief

app = FastAPI()

with open(os.path.join(os.path.dirname(__file__), "mock_data.json")) as f:
    CONTACTS = {c["bank_id"]: c for c in json.load(f)["contacts"]}

class PreferenceRequest(BaseModel):
    preference: str

class IngestRequest(BaseModel):
    text: str

@app.post("/api/preferences")
def save_preference(req: PreferenceRequest):
    retain_meeting(
        bank_id="user_preferences",
        content=req.preference,
        document_id=str(uuid.uuid4())
    )
    return {"status": "ok"}

@app.post("/api/ingest/{bank_id}")
def ingest_meeting(bank_id: str, req: IngestRequest):
    retain_meeting(
        bank_id=bank_id,
        content=req.text,
        document_id=str(uuid.uuid4())
    )
    return {"status": "ok"}

@app.get("/api/contacts")
def list_contacts():
    return [{"bank_id": c["bank_id"], "name": c["name"], "company": c["company"]} for c in CONTACTS.values()]

@app.get("/api/brief/{bank_id}")
def get_brief(bank_id: str):
    contact = CONTACTS.get(bank_id)
    if not contact:
        raise HTTPException(404, "unknown contact")
    
    recalled = recall_for_contact(bank_id, f"Prep me for a meeting with {contact['name']}")
    memory_text = "\n".join(item.text for item in recalled)
    
    try:
        prefs = recall_for_contact("user_preferences", "How does the user want the meeting brief formatted?")
        user_preferences = "\n".join(item.text for item in prefs)
    except Exception:
        user_preferences = ""
        
    return build_brief(contact=contact["name"], memory_text=memory_text, user_preferences=user_preferences)

@app.get("/api/memory/{bank_id}")
def get_memory(bank_id: str):
    contact = CONTACTS.get(bank_id)
    if not contact:
        raise HTTPException(404, "unknown contact")
    facts = recall_for_contact(bank_id, "everything known about this contact")
    models = reflect_for_contact(bank_id, "what patterns have you noticed about this contact")
    return {"facts": facts, "mental_models": models}

app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")
