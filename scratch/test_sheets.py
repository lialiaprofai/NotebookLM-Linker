import os
import sys
import pickle
from googleapiclient.discovery import build

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.drive_sync import get_credentials

SPREADSHEET_ID = "1TkbWzKUMomQJ284SqfQMAIa8ITnmi5psHUJs-NlLLqM"
SHEET_NAME = "выгрузка из jdy"

def main():
    try:
        print("Obtaining credentials...")
        creds = get_credentials()
        print("Building Sheets service...")
        service = build('sheets', 'v4', credentials=creds)
        
        # Read sheet metadata
        print("Reading sheet metadata...")
        sheet_meta = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
        title = sheet_meta.get('properties', {}).get('title', 'Unknown Title')
        print(f"Spreadsheet Title: {title}")
        sheets = [s.get('properties', {}).get('title') for s in sheet_meta.get('sheets', [])]
        print(f"Available Sheets: {sheets}")
        
        if SHEET_NAME not in sheets:
            print(f"Error: Sheet '{SHEET_NAME}' not found.")
            return

        # Fetch range A1:T200 (first 200 rows for testing)
        range_name = f"'{SHEET_NAME}'!A1:T200"
        print(f"Fetching range {range_name}...")
        result = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=range_name).execute()
        rows = result.get('values', [])
        print(f"Retrieved {len(rows)} rows.")
        
        if len(rows) > 0:
            print("Headers (Row 1):", rows[0])
            if len(rows) > 1:
                print("First data row:", rows[1])
                
    except Exception as e:
        print(f"Error occurred: {e}")

if __name__ == "__main__":
    main()
