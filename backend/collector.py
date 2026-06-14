import os
import re
import json
import requests
from bs4 import BeautifulSoup
from backend.config import PERPLEXITY_API_KEY, DATA_DIR
from youtube_transcript_api import YouTubeTranscriptApi
from backend.drive_sync import upload_text_file, get_or_create_folder

def clean_slug(text: str) -> str:
    """
    Cleans a text string to make it a valid folder/file name slug.
    """
    text = text.lower()
    text = re.sub(r'[^a-z0-9_а-яё]', '_', text) # Support Russian characters in filenames
    text = re.sub(r'_+', '_', text)
    return text.strip('_')

def search_perplexity(query: str, perplexity_api_key: str = None) -> tuple:
    """
    Queries Perplexity API for the given query and returns (content, citations).
    """
    key = perplexity_api_key or PERPLEXITY_API_KEY
    if not key:
        print(f"Skipping Perplexity search for query: '{query}' (No API Key)")
        return "", []
    
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    
    data = {
        "model": "sonar",
        "messages": [
            {"role": "system", "content": "You are a professional research assistant. Provide deep, accurate technical details and facts, and structure your output in Markdown format."},
            {"role": "user", "content": query}
        ]
    }
    
    try:
        response = requests.post("https://api.perplexity.ai/chat/completions", json=data, headers=headers, timeout=45)
        response.raise_for_status()
        result = response.json()
        
        content = result["choices"][0]["message"]["content"]
        citations = result.get("citations", [])
        return content, citations
    except Exception as e:
        print(f"Error querying Perplexity: {e}")
        return f"[Ошибка при получении данных от Perplexity: {e}]", []

def find_youtube_videos(query: str, perplexity_api_key: str = None) -> list:
    """
    Uses Perplexity to find 2 relevant YouTube video URLs for a search query.
    """
    key = perplexity_api_key or PERPLEXITY_API_KEY
    if not key:
        return []
    
    perplexity_query = f"Find 2 high-quality YouTube video tutorials or reviews for query: '{query}'. Return only a raw JSON list of objects, each containing 'url' and 'title', and no other text."
    response_text, _ = search_perplexity(perplexity_query, perplexity_api_key=perplexity_api_key)
    
    try:
        json_match = re.search(r"(\[.*\])", response_text, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(1))
        return json.loads(response_text)
    except Exception as e:
        print(f"Could not parse YouTube links from Perplexity: {e}. Attempting Regex fallback.")
        urls = re.findall(r"(https?://(?:www\.)?youtube\.com/[^\s)]+|https?://youtu\.be/[^\s)]+)", response_text)
        videos = []
        for i, url in enumerate(urls[:2]):
            videos.append({"url": url, "title": f"YouTube Video {i+1}"})
        return videos

def scrape_url(url: str) -> str:
    """
    Scrapes a webpage, extracts its main content, and formats it as Markdown.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove noisy elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside", "noscript", "iframe"]):
            element.decompose()
            
        # Extract title
        title = soup.title.string.strip() if soup.title else "Web Article"
        
        content_lines = []
        content_lines.append(f"# {title}")
        content_lines.append(f"**Источник (URL):** {url}\n")
        
        # Attempt to find main content
        main_content = soup.find('article') or soup.find('main') or soup.find(id='content') or soup.find(class_='content') or soup
        
        for elem in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'p', 'li', 'pre', 'code']):
            tag = elem.name
            text = elem.get_text().strip()
            if not text:
                continue
                
            if tag == 'h1':
                content_lines.append(f"\n# {text}\n")
            elif tag == 'h2':
                content_lines.append(f"\n## {text}\n")
            elif tag == 'h3':
                content_lines.append(f"\n### {text}\n")
            elif tag == 'h4':
                content_lines.append(f"\n#### {text}\n")
            elif tag == 'p':
                content_lines.append(f"\n{text}\n")
            elif tag == 'li':
                content_lines.append(f"- {text}")
            elif tag == 'pre':
                content_lines.append(f"\n```\n{text}\n```\n")
            elif tag == 'code' and elem.parent.name != 'pre':
                content_lines.append(f"`{text}`")
                    
        cleaned_text = "\n".join(content_lines)
        # Collapse multiple empty lines
        cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
        return cleaned_text
    except Exception as e:
        print(f"Failed to scrape URL {url}: {e}")
        return f"[Ошибка при получении содержимого страницы {url}: {e}]"

def extract_video_id(url: str) -> str:
    """
    Extracts the 11-character YouTube video ID from a URL.
    """
    patterns = [
        r"(?:v=|\/embed\/|\/\d{1,2}\/|\/vi\/|\/v\/|https:\/\/youtu.be\/|https:\/\/www.youtube.com\/shorts\/)([a-zA-Z0-9_-]{11})"
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return ""

def fetch_youtube_transcript(video_id: str) -> str:
    """
    Fetches the transcript for a YouTube video using youtube-transcript-api.
    """
    try:
        transcript = YouTubeTranscriptApi().fetch(video_id, languages=['ru', 'en'])
        text = " ".join([item.text for item in transcript])
        return text
    except Exception as e:
        print(f"Error fetching YouTube transcript: {e}")
        return f"[Не удалось получить транскрипт для видео ID {video_id}: {e}]"

def fetch_youtube_transcript_fallback(video_url: str, video_title: str, perplexity_api_key: str = None) -> str:
    """
    Fallback method using Perplexity to extract transcript or detailed summary of a YouTube video.
    """
    key = perplexity_api_key or PERPLEXITY_API_KEY
    if not key:
        return "[Perplexity API key not set, cannot perform fallback]"
        
    query = (
        f"Provide a highly detailed, comprehensive section-by-section transcript or summary of the YouTube video: '{video_url}' (Title: {video_title}). "
        f"Extract key concepts, timestamps if possible, and main points in Russian, so that it can be used in Google NotebookLM as the source."
    )
    
    try:
        content, _ = search_perplexity(query, perplexity_api_key=perplexity_api_key)
        if content and "[Ошибка при получении" not in content:
            return f"## [Автоматический обзор от Perplexity (Обход блокировки YouTube)]\n\n{content}"
        return f"[Не удалось получить обзор видео от Perplexity: {content}]"
    except Exception as e:
        return f"[Ошибка при получении обхода от Perplexity: {e}]"

def get_existing_links(service, folder_id: str) -> list:
    """
    Finds SOURCES_INDEX in the folder and extracts all existing URLs.
    """
    query = f"name = 'SOURCES_INDEX' and '{folder_id}' in parents and trashed = false"
    try:
        results = service.files().list(q=query, fields="files(id, mimeType)").execute()
        files = results.get('files', [])
        if not files:
            return []
            
        file_id = files[0]['id']
        mime_type = files[0].get('mimeType', '')
        
        if 'vnd.google-apps.document' in mime_type:
            content = service.files().export(fileId=file_id, mimeType='text/plain').execute().decode('utf-8')
        else:
            content = service.files().get_media(fileId=file_id).execute().decode('utf-8')
            
        # Extract URLs
        import re
        urls = re.findall(r'https?://[^\s)]+', content)
        return [url.strip() for url in urls]
    except Exception as e:
        print(f"Error reading existing links from Drive: {e}")
        return []

def sync_approved_source(service, source: dict, folder_id: str, progress_callback=None, existing_urls: list = None, perplexity_api_key: str = None) -> dict:
    """
    Processes a single approved source: collects content (Perplexity or YouTube Transcript)
    and uploads it to the given Google Drive folder.
    Returns a dict with 'uploaded_files' and 'original_links'.
    """
    source_id = source.get("id", "source")
    title = source.get("title", "Source Document")
    query = source.get("query", "")
    source_type = source.get("type", "documentation")
    
    uploaded_files = []
    original_links = []
    
    if progress_callback:
        progress_callback(f"Начало сбора: '{title}' ({source_type})...")
        
    # Check if API Key is set, else generate mock data
    key = perplexity_api_key or PERPLEXITY_API_KEY
    if not key:
        if progress_callback:
            progress_callback(f"Заглушка (нет API ключа): '{title}'...")
        
        # Generate mock content
        mock_content = f"# {title}\n\nЭто демонстрационный файл для исследования. API ключ Perplexity не задан.\n\n## Детали\nЗапрос: '{query}'\nТип: {source_type}\n\nКонтент сгенерирован локально для проверки синхронизации с Google Drive."
        filename = f"{source_id}_{clean_slug(title)}.md"
        
        file_info = upload_text_file(service, filename, mock_content, folder_id)
        uploaded_files.append({"name": filename, "link": file_info.get("webViewLink", "")})
        
        mock_url = f"https://example.com/mock/{clean_slug(title)}"
        original_links.append({"title": title, "url": mock_url, "type": source_type})
        
        return {
            "uploaded_files": uploaded_files,
            "original_links": original_links
        }
        
    # Stage 1: Documentation / Articles
    if source_type in ["documentation", "article"]:
        content, citations = search_perplexity(query, perplexity_api_key=perplexity_api_key)
        
        # 1. Upload Perplexity Overview
        if content:
            filename = f"{source_id}_{clean_slug(title)}_Overview.md"
            markdown_content = f"# Обзор: {title}\n\n**Оригинальный поисковый запрос:** {query}\n\n{content}"
            
            if progress_callback:
                progress_callback(f"Выгрузка обзора на Google Drive: {filename}...")
                
            file_info = upload_text_file(service, filename, markdown_content, folder_id)
            uploaded_files.append({"name": filename, "link": file_info.get("webViewLink", "")})
            
        # 2. Scrape citation URLs (up to 2)
        if citations:
            valid_urls = [url for url in citations if url.startswith("http") and "youtube.com" not in url and "youtu.be" not in url][:2]
            for idx, url in enumerate(valid_urls):
                link_title = f"{title} (Ссылка {idx+1})"
                original_links.append({"title": link_title, "url": url, "type": source_type})
                
                if existing_urls and url in existing_urls:
                    if progress_callback:
                        progress_callback(f"[Уже загружено] Пропуск скачивания: {url}")
                    continue
                    
                if progress_callback:
                    progress_callback(f"Сбор полного текста первоисточника: {url}...")
                
                scraped_content = scrape_url(url)
                if scraped_content and len(scraped_content.strip()) > 300 and "[Ошибка при получении" not in scraped_content:
                    scraped_filename = f"{source_id}_full_{idx+1}_{clean_slug(title)}.md"
                    if progress_callback:
                        progress_callback(f"Выгрузка полного текста на Google Drive: {scraped_filename}...")
                    scraped_file_info = upload_text_file(service, scraped_filename, scraped_content, folder_id)
                    uploaded_files.append({"name": scraped_filename, "link": scraped_file_info.get("webViewLink", "")})
                else:
                    if progress_callback:
                        progress_callback(f"Предупреждение: Не удалось извлечь текст по ссылке {url} (будет использован только обзор)")
        else:
            # Add a fallback query link
            fallback_url = f"https://www.google.com/search?q={requests.utils.quote(query)}"
            original_links.append({"title": title, "url": fallback_url, "type": source_type})
            
    # Stage 2: YouTube Videos and Transcripts
    elif source_type == "youtube":
        videos = find_youtube_videos(query)
        if not videos:
            if progress_callback:
                progress_callback(f"Не удалось найти YouTube видео по запросу: '{query}'")
            return {"uploaded_files": [], "original_links": []}
            
        for idx, video in enumerate(videos[:2]): # Limit to top 2 videos
            url = video.get("url", "")
            video_title = video.get("title", f"YouTube Video {idx+1}")
            video_id = extract_video_id(url)
            
            original_links.append({"title": video_title, "url": url, "type": "youtube"})
            
            if existing_urls and url in existing_urls:
                if progress_callback:
                    progress_callback(f"[Уже загружено] Пропуск транскрипта: {url}")
                continue
                
            if video_id:
                if progress_callback:
                    progress_callback(f"Получение транскрипта для видео: '{video_title}'...")
                    
                transcript = fetch_youtube_transcript(video_id)
                
                # Check if YouTube blocked us (very common on VPS/local IPs)
                if transcript.startswith("[Не удалось получить"):
                    if progress_callback:
                        progress_callback("Блокировка YouTube. Запуск обхода через Perplexity...")
                    transcript = fetch_youtube_transcript_fallback(url, video_title, perplexity_api_key=perplexity_api_key)
                    
                filename = f"{source_id}_yt_{video_id}.md"
                
                markdown_content = f"# Расшифровка видео: {video_title}\n\n**Ссылка:** {url}\n**ID видео:** {video_id}\n\n## Полный текст расшифровки\n{transcript}"
                
                if progress_callback:
                    progress_callback(f"Выгрузка транскрипта на Google Drive: {filename}...")
                    
                file_info = upload_text_file(service, filename, markdown_content, folder_id)
                uploaded_files.append({"name": filename, "link": file_info.get("webViewLink", "")})
                
    return {
        "uploaded_files": uploaded_files,
        "original_links": original_links
    }
