import requests
import os
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("ANTHROPIC_API_KEY")
if key:
    key = key.strip()
print(f"Testing key: {key[:15]}...{key[-5:] if key else ''} (length={len(key) if key else 0})")

headers = {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
}

payload = {
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 100,
    "messages": [
        {"role": "user", "content": "Hello"}
    ]
}

try:
    response = requests.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Exception: {e}")
