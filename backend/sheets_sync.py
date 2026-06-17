import os
from googleapiclient.discovery import build
from backend.drive_sync import get_credentials

SPREADSHEET_ID = "1TkbWzKUMomQJ284SqfQMAIa8ITnmi5psHUJs-NlLLqM"
DEFAULT_SHEET = "выгрузка из jdy"

def get_sheets_service():
    """
    Returns an authorized Google Sheets API v4 service.
    """
    creds = get_credentials()
    return build('sheets', 'v4', credentials=creds)

def get_default_spreadsheet_info():
    """
    Fetches the metadata of the pre-configured spreadsheet.
    """
    service = get_sheets_service()
    sheet_meta = service.spreadsheets().get(spreadsheetId=SPREADSHEET_ID).execute()
    title = sheet_meta.get('properties', {}).get('title', 'Google Sheet')
    sheets = [s.get('properties', {}).get('title') for s in sheet_meta.get('sheets', [])]
    return {
        "spreadsheet_id": SPREADSHEET_ID,
        "title": title,
        "sheets": sheets
    }

def get_sheet_values(sheet_name: str, range_name: str = "A1:T10000"):
    """
    Retrieves values from the specified sheet and range.
    """
    service = get_sheets_service()
    full_range = f"'{sheet_name}'!{range_name}"
    result = service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range=full_range).execute()
    return result.get('values', [])

def search_article_in_sheet(query: str, sheet_name: str = DEFAULT_SHEET):
    """
    Searches for an article inside the sheet by matching query as a substring in Column J (index 9).
    Extracts columns:
    - A (index 0): Order no
    - B (index 1): Date
    - C (index 2): Supplier
    - G (index 6): Currency
    - H (index 7): Rate
    - J (index 9): Article
    - P (index 15): Price F
    - S (index 18): Price A
    """
    rows = get_sheet_values(sheet_name)
    if not rows:
        return []
        
    headers = rows[0]
    data_rows = rows[1:]
    
    clean_query = query.strip().lower()
    matches = []
    
    for row_idx, row in enumerate(data_rows):
        # Pad row with empty strings if it has fewer columns than needed
        if len(row) < 10:
            continue
            
        # Column J is index 9
        article_name = row[9].strip() if len(row) > 9 else ""
        if not article_name:
            continue
            
        # Match case-insensitive substring
        if clean_query in article_name.lower():
            # Safely get other columns
            order_no = row[0].strip() if len(row) > 0 else ""
            date_val = row[1].strip() if len(row) > 1 else ""
            supplier = row[2].strip() if len(row) > 2 else ""
            currency = row[6].strip() if len(row) > 6 else ""
            rate_val = row[7].strip() if len(row) > 7 else ""
            price_f = row[15].strip() if len(row) > 15 else "0"
            price_a = row[18].strip() if len(row) > 18 else "0"
            
            # Format according to template:
            # Артикул {артикул} закупался в заказе {номер_заказа} от {дата}, поставщик {поставщик}, валюта заказа {валюта} по курсу {курс}. Цена F = {P}, A = {S}
            formatted = (
                f"Артикул {article_name} закупался в заказе {order_no} от {date_val}, "
                f"поставщик {supplier}, валюта заказа {currency} по курсу {rate_val}. "
                f"Цена F = {price_f}, A = {price_a}"
            )
            
            matches.append({
                "row_number": row_idx + 2, # 1-indexed, skipping header row
                "article": article_name,
                "order_no": order_no,
                "date": date_val,
                "supplier": supplier,
                "currency": currency,
                "rate": rate_val,
                "price_f": price_f,
                "price_a": price_a,
                "formatted": formatted
            })
            
    return matches
