import os, json, time, logging
from google import genai
from google.genai import errors as genai_errors

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
FALLBACK_MODEL = os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash")

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


def _call_gemini(model: str, prompt: str, max_retries: int = 5) -> str:
    """Call Gemini with exponential backoff retry on transient errors."""
    last_error = None
    for attempt in range(max_retries):
        try:
            response = _client.models.generate_content(
                model=model,
                contents=prompt,
                config={"response_mime_type": "application/json"},
            )
            return response.text
        except genai_errors.ServerError as e:
            last_error = e
            wait = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(
                "Gemini %s returned %s (attempt %d/%d). Retrying in %ds...",
                model, e, attempt + 1, max_retries, wait,
            )
            time.sleep(wait)
        except genai_errors.APIError as e:
            # Non-retryable API errors (auth, bad request, etc.)
            logger.error("Gemini API error (non-retryable): %s", e)
            raise
    # All retries exhausted
    raise last_error


def build_brief(contact: str, memory_text: str, user_preferences: str = "") -> dict:
    prompt = BRIEF_PROMPT.format(
        contact=contact,
        memory=memory_text or "No prior history.",
        preferences=user_preferences or "No specific style preferences.",
    )

    # Try primary model first
    try:
        text = _call_gemini(MODEL, prompt)
        return json.loads(text)
    except genai_errors.ServerError:
        logger.warning(
            "Primary model '%s' exhausted retries. Falling back to '%s'.",
            MODEL, FALLBACK_MODEL,
        )

    # Try fallback model
    try:
        text = _call_gemini(FALLBACK_MODEL, prompt)
        return json.loads(text)
    except genai_errors.ServerError:
        logger.error("Both models ('%s', '%s') are unavailable.", MODEL, FALLBACK_MODEL)
        raise
    except json.JSONDecodeError as e:
        logger.error("Fallback model returned invalid JSON: %s", e)
        raise


def transcribe_media(file_path: str) -> str:
    """Transcribe an audio/video file using Gemini multimodal."""
    uploaded = _client.files.upload(file=file_path)

    # Wait for Gemini to finish processing the file (especially video)
    while uploaded.state == "PROCESSING":
        time.sleep(2)
        uploaded = _client.files.get(name=uploaded.name)

    if uploaded.state == "FAILED":
        raise RuntimeError("Gemini failed to process the uploaded media file.")

    prompt = (
        "Transcribe this recording into a detailed, accurate meeting transcript. "
        "Include all spoken content verbatim. If there are multiple speakers, "
        "label them (e.g., Speaker 1, Speaker 2). Output only the transcript text."
    )

    try:
        response = _client.models.generate_content(
            model=MODEL, contents=[uploaded, prompt]
        )
        return response.text
    except genai_errors.ServerError:
        logger.warning("Primary model failed for transcription, trying fallback.")
        response = _client.models.generate_content(
            model=FALLBACK_MODEL, contents=[uploaded, prompt]
        )
        return response.text
    finally:
        try:
            _client.files.delete(name=uploaded.name)
        except Exception:
            pass

