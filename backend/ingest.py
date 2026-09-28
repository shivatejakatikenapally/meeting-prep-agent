import json, os
from dotenv import load_dotenv
from hindsight_wrapper import retain_meeting

load_dotenv()

with open("mock_data.json") as f:
    data = json.load(f)

for contact in data["contacts"]:
    bank_id = contact["bank_id"]
    for meeting in contact["meetings"]:
        retain_meeting(bank_id, meeting["transcript"], meeting["id"])
        print(f"retained {meeting['id']} into {bank_id}")
