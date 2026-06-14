import os
import pickle
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.http import MediaFileUpload

# OAuth Scopes
# drive.file allows read/write of files/folders created by this app
SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDENTIALS_FILE = os.path.join(BASE_DIR, "credentials.json")
TOKEN_FILE = os.path.join(BASE_DIR, "token.json")

class GoogleDriveAuthError(Exception):
    """Exception raised when credentials.json is missing or authentication fails."""
    pass

def find_credentials_file():
    """
    Finds the credentials JSON file in the project directory.
    Checks for credentials.json or any client_secret_*.json file.
    """
    if os.path.exists(CREDENTIALS_FILE):
        return CREDENTIALS_FILE
    if os.path.exists(BASE_DIR):
        for file in os.listdir(BASE_DIR):
            if file.startswith("client_secret_") and file.endswith(".json"):
                return os.path.join(BASE_DIR, file)
    return CREDENTIALS_FILE

def get_credentials():
    """
    Retrieves OAuth2 credentials from token.json or credentials.json.
    Raises GoogleDriveAuthError if credentials.json is missing.
    """
    creds = None
    
    # Load cached tokens if available
    if os.path.exists(TOKEN_FILE):
        try:
            with open(TOKEN_FILE, 'rb') as token:
                creds = pickle.load(token)
        except Exception as e:
            print(f"Error loading token.json: {e}")
            
    # If there are no (valid) credentials, prompt user to log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Error refreshing access token: {e}")
                creds = None
                
        if not creds:
            creds_file = find_credentials_file()
            if not os.path.exists(creds_file):
                raise GoogleDriveAuthError(
                    "Файл 'credentials.json' (или 'client_secret_*.json') не найден. "
                    "Пожалуйста, скачайте его из Google Cloud Console и положите в корень проекта."
                )
            
            flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
            creds = flow.run_local_server(port=0, open_browser=True)
            
        # Save credentials for future runs
        with open(TOKEN_FILE, 'wb') as token:
            pickle.dump(creds, token)
            
    return creds

def get_drive_service():
    """
    Builds and returns Google Drive API service.
    """
    creds = get_credentials()
    return build('drive', 'v3', credentials=creds)

def check_drive_auth_status() -> dict:
    """
    Returns authentication status helper for the UI.
    """
    if os.path.exists(TOKEN_FILE):
        return {"authenticated": True, "has_credentials": True, "message": "Авторизован"}
    creds_file = find_credentials_file()
    if os.path.exists(creds_file):
        return {"authenticated": False, "has_credentials": True, "message": f"Файл {os.path.basename(creds_file)} найден, требуется авторизация"}
    return {"authenticated": False, "has_credentials": False, "message": "Файл credentials.json отсутствует"}

def get_or_create_folder(service, folder_name: str, parent_id: str = None) -> str:
    """
    Finds a folder by name under the specified parent. Creates it if not found.
    """
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        query += f" and '{parent_id}' in parents"
        
    results = service.files().list(q=query, fields="files(id)").execute()
    files = results.get('files', [])
    
    if files:
        return files[0]['id']
        
    # Create the folder if it does not exist
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]
        
    folder = service.files().create(body=file_metadata, fields='id').execute()
    return folder.get('id')

def upload_text_file(service, filename: str, content: str, folder_id: str, convert_to_gdoc: bool = True) -> dict:
    """
    Uploads raw text content to Google Drive inside the specified folder.
    By default, converts to Google Doc format for optimal display in Drive.
    """
    # Write content to a temp file
    temp_path = os.path.join(BASE_DIR, "temp_upload.txt")
    with open(temp_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    file_metadata = {
        'name': filename.replace('.md', '').replace('.txt', ''),
        'parents': [folder_id]
    }
    
    if convert_to_gdoc:
        # Convert to Google Doc format on upload
        file_metadata['mimeType'] = 'application/vnd.google-apps.document'
        
    media = MediaFileUpload(temp_path, mimetype='text/plain', resumable=True)
    
    # Check if a file with the same name already exists in this folder to overwrite it
    query = f"name = '{file_metadata['name']}' and '{folder_id}' in parents and trashed = false"
    existing_files = service.files().list(q=query, fields="files(id)").execute().get('files', [])
    
    try:
        if existing_files:
            file_id = existing_files[0]['id']
            # Update file content
            file = service.files().update(
                fileId=file_id,
                media_body=media,
                fields='id, name, webViewLink'
            ).execute()
        else:
            # Create a new file
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, webViewLink'
            ).execute()
            
        return file
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)
