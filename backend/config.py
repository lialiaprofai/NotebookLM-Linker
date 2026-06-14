import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
PERPLEXITY_API_KEY = os.getenv("PERPLEXITY_API_KEY")
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")

# Configure Google Generative AI
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("Warning: GEMINI_API_KEY is not set in the environment variables.")

# Base directory & Data directory configuration
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

# Get default Gemini model from environment or default to gemini-flash-latest
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

def get_gemini_model(model_name=None, api_key=None):
    """
    Returns a configured GenerativeModel instance.
    Prioritizes the GEMINI_MODEL environment variable, then the parameter,
    and defaults to gemini-flash-latest.
    """
    key = api_key or os.getenv("GEMINI_API_KEY")
    if key:
        genai.configure(api_key=key)
    name = os.getenv("GEMINI_MODEL") or model_name or "gemini-flash-latest"
    if name == "gemini-1.5-flash":
        name = "gemini-flash-latest"
    print(f"Using Gemini Model: {name} (API key override: {bool(api_key)})")
    return genai.GenerativeModel(name)
