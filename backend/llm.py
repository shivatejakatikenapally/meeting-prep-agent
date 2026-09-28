import os, json
from google import genai

_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")

BRIEF_PROMPT = """You are an executive assistant preparing someone for a meeting with {contact}.
Use ONLY the memory below. Do not invent facts that are not in it.

Memory:
{memory}

User Style Preferences (IMPORTANT - FOLLOW THESE EXACTLY IF PROVIDED):
{preferences}

Return strict JSON with these keys:
- tldr: 2-3 sentences on where things stand
- follow_ups: array of outstanding promises or open threads
- quirks: array of this contact's preferences or communication patterns
- icebreaker: one suggested opening line based on real past context

If the memory is thin (this is an early meeting), say so plainly instead of inventing detail.
"""

def build_brief(contact: str, memory_text: str, user_preferences: str = "") -> dict:
    prompt = BRIEF_PROMPT.format(contact=contact, memory=memory_text or "No prior history.", preferences=user_preferences or "No specific style preferences.")
    response = _client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config={"response_mime_type": "application/json"},
    )
    return json.loads(response.text)
