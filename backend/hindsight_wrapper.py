import os
from hindsight_client import Hindsight

_client = None

def get_client():
    global _client
    if _client is None:
        kwargs = {"base_url": os.environ["HINDSIGHT_BASE_URL"]}
        if os.environ.get("HINDSIGHT_API_KEY"):
            kwargs["api_key"] = os.environ["HINDSIGHT_API_KEY"]  # verify kwarg name for Cloud
        _client = Hindsight(**kwargs)
    return _client

async def retain_meeting(bank_id: str, content: str, document_id: str):
    return await get_client().aretain(bank_id=bank_id, content=content, document_id=document_id)

async def recall_for_contact(bank_id: str, query: str):
    return await get_client().arecall(bank_id=bank_id, query=query)

async def reflect_for_contact(bank_id: str, query: str):
    return await get_client().areflect(bank_id=bank_id, query=query)
