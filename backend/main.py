import os, json, asyncio, tempfile
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uuid
from hindsight_wrapper import recall_for_contact, reflect_for_contact, retain_meeting
from llm import build_brief, transcribe_media

app = FastAPI()

with open(os.path.join(os.path.dirname(__file__), "mock_data.json")) as f:
    CONTACTS = {c["bank_id"]: c for c in json.load(f)["contacts"]}

TRANSCRIPTS_FILE = os.path.join(os.path.dirname(__file__), "transcripts_log.json")
if not os.path.exists(TRANSCRIPTS_FILE):
    with open(TRANSCRIPTS_FILE, "w") as f:
        json.dump({}, f)

def log_transcript(bank_id: str, content: str):
    import datetime
    with open(TRANSCRIPTS_FILE, "r") as f:
        data = json.load(f)
    if bank_id not in data:
        data[bank_id] = []
    data[bank_id].append({
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "text": content
    })
    with open(TRANSCRIPTS_FILE, "w") as f:
        json.dump(data, f, indent=2)

class PreferenceRequest(BaseModel):
    preference: str

class IngestRequest(BaseModel):
    text: str

@app.post("/api/preferences")
async def save_preference(req: PreferenceRequest):
    await retain_meeting(
        bank_id="user_preferences",
        content=req.preference,
        document_id=str(uuid.uuid4())
    )
    return {"status": "ok"}

@app.post("/api/ingest/{bank_id}")
async def ingest_meeting(bank_id: str, req: IngestRequest):
    await retain_meeting(
        bank_id=bank_id,
        content=req.text,
        document_id=str(uuid.uuid4())
    )
    log_transcript(bank_id, req.text)
    return {"status": "ok"}

@app.post("/api/transcribe/{bank_id}")
async def transcribe_meeting(bank_id: str, file: UploadFile = File(...)):
    contact = CONTACTS.get(bank_id)
    if not contact:
        raise HTTPException(404, "unknown contact")

    suffix = os.path.splitext(file.filename or ".webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        transcript = await asyncio.to_thread(transcribe_media, tmp_path)
        await retain_meeting(
            bank_id=bank_id,
            content=transcript,
            document_id=str(uuid.uuid4())
        )
        log_transcript(bank_id, transcript)
        return {"transcript": transcript, "status": "ok"}
    finally:
        os.unlink(tmp_path)

@app.get("/api/transcripts/{bank_id}")
def get_transcripts(bank_id: str):
    with open(TRANSCRIPTS_FILE, "r") as f:
        data = json.load(f)
    return data.get(bank_id, [])

class NewContactRequest(BaseModel):
    name: str
    company: str

@app.post("/api/contacts")
def add_contact(req: NewContactRequest):
    import re
    bank_id = re.sub(r'[^a-z0-9-]', '-', req.name.lower() + "-" + req.company.lower())
    bank_id = re.sub(r'-+', '-', bank_id).strip('-')
    
    new_contact = {"bank_id": bank_id, "name": req.name, "company": req.company}
    CONTACTS[bank_id] = new_contact
    
    mock_file = os.path.join(os.path.dirname(__file__), "mock_data.json")
    with open(mock_file, "r") as f:
        data = json.load(f)
    data["contacts"].append(new_contact)
    with open(mock_file, "w") as f:
        json.dump(data, f, indent=2)
        
    return new_contact

@app.get("/api/contacts")
def list_contacts():
    return [{"bank_id": c["bank_id"], "name": c["name"], "company": c["company"]} for c in CONTACTS.values()]

@app.get("/api/brief/{bank_id}")
async def get_brief(bank_id: str):
    contact = CONTACTS.get(bank_id)
    if not contact:
        raise HTTPException(404, "unknown contact")
    
    recalled = await recall_for_contact(bank_id, f"Prep me for a meeting with {contact['name']}")
    memory_text = "\n".join(item.text for item in recalled)
    
    try:
        prefs = await recall_for_contact("user_preferences", "How does the user want the meeting brief formatted?")
        user_preferences = "\n".join(item.text for item in prefs)
    except Exception:
        user_preferences = ""
        
    return build_brief(contact=contact["name"], memory_text=memory_text, user_preferences=user_preferences)

@app.get("/api/memory/{bank_id}")
async def get_memory(bank_id: str):
    contact = CONTACTS.get(bank_id)
    if not contact:
        raise HTTPException(404, "unknown contact")
    facts = await recall_for_contact(bank_id, "everything known about this contact")
    models = await reflect_for_contact(bank_id, "what patterns have you noticed about this contact")
    return {"facts": facts, "mental_models": models}

app.mount("/", StaticFiles(directory="../frontend", html=True), name="static")
