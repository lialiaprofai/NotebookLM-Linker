import os
import sys
import json
import uuid
import argparse
from typing import List, Dict, Optional
from pydantic import BaseModel
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.config import DATA_DIR, PORT, HOST
from backend.planner import generate_plan, SearchPlan, ProposedSource
from backend.collector import sync_approved_source, clean_slug, get_existing_links
from backend.drive_sync import check_drive_auth_status, get_drive_service, get_or_create_folder

# In-memory store for running background research and sync tasks
TOPIC_TASKS = {}

# FastAPI Application Definition
app = FastAPI(title="NotebookLM Drive Sync API")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PlanTopicRequest(BaseModel):
    topic: str
    depth: Optional[str] = "standard"
    freshness: Optional[bool] = True
    authority_boost: Optional[bool] = True
    chat_history: Optional[List[Dict]] = []
    gemini_api_key: Optional[str] = None
    perplexity_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    model_provider: Optional[str] = "gemini"

class SyncTopicRequest(BaseModel):
    task_id: str
    topic: str
    refined_topic: str
    approved_sources: List[Dict]
    perplexity_api_key: Optional[str] = None

def run_sync_workflow(task_id: str, topic: str, refined_topic: str, approved_sources: List[Dict], perplexity_api_key: Optional[str] = None):
    """
    Background worker that fetches and uploads approved sources to Google Drive.
    """
    topic_slug = clean_slug(topic)
    try:
        TOPIC_TASKS[task_id] = {
            "status": "running",
            "step": "syncing",
            "message": "Подключение к Google Drive и подготовка папок...",
            "log": ["Запуск синхронизации с Google Drive..."]
        }
        
        # Step 1: Connect to Google Drive
        try:
            service = get_drive_service()
            TOPIC_TASKS[task_id]["log"].append("Успешное подключение к Google Drive API.")
        except Exception as auth_err:
            raise Exception(f"Ошибка авторизации Google Drive: {auth_err}. Убедитесь, что настроили credentials.json")
            
        # Step 2: Create Folder Structure on Drive
        root_folder_id = get_or_create_folder(service, "NotebookLM_Sources")
        topic_folder_id = get_or_create_folder(service, refined_topic, parent_id=root_folder_id)
        TOPIC_TASKS[task_id]["log"].append(f"Создана/найдена папка исследования: 'NotebookLM_Sources/{refined_topic}'")
        
        # Step 2.5: Fetch existing links for duplicate checking
        existing_urls = []
        try:
            existing_urls = get_existing_links(service, topic_folder_id)
            if existing_urls:
                TOPIC_TASKS[task_id]["log"].append(f"Найдено {len(existing_urls)} ранее загруженных ссылок. Дубликаты будут автоматически пропущены.")
        except Exception as e:
            TOPIC_TASKS[task_id]["log"].append(f"Предупреждение при поиске существующих ссылок: {e}")
        
        # Save local metadata too for reference
        topic_local_dir = os.path.join(DATA_DIR, "topics", topic_slug)
        os.makedirs(topic_local_dir, exist_ok=True)
        
        metadata = {
            "slug": topic_slug,
            "original_topic": topic,
            "refined_topic": refined_topic,
            "drive_folder_id": topic_folder_id,
            "approved_sources": approved_sources
        }
        with open(os.path.join(topic_local_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
            
        all_original_links = []
        
        # Step 3: Fetch and upload each approved source
        for idx, source in enumerate(approved_sources):
            title = source.get("title", "Источник")
            TOPIC_TASKS[task_id]["message"] = f"Обработка ({idx+1}/{len(approved_sources)}): {title}..."
            
            def log_progress(msg):
                TOPIC_TASKS[task_id]["log"].append(msg)
                
            res = sync_approved_source(
                service=service,
                source=source,
                folder_id=topic_folder_id,
                progress_callback=log_progress,
                existing_urls=existing_urls,
                perplexity_api_key=perplexity_api_key
            )
            
            uploaded_files = res.get("uploaded_files", [])
            source_links = res.get("original_links", [])
            all_original_links.extend(source_links)
            
            # Add newly processed links to existing_urls to prevent duplication in this run
            for link_item in source_links:
                url_val = link_item.get("url")
                if url_val and url_val not in existing_urls:
                    existing_urls.append(url_val)
            
            if uploaded_files:
                for file_info in uploaded_files:
                    TOPIC_TASKS[task_id]["log"].append(f"Успешно загружен файл: {file_info['name']}")
            else:
                TOPIC_TASKS[task_id]["log"].append(f"Предупреждение: Не удалось собрать новые данные для '{title}' (возможно, они уже были загружены)")
                
        # Step 4: Generate and upload SOURCES_INDEX.md
        if all_original_links:
            TOPIC_TASKS[task_id]["message"] = "Создание индекса ссылок на Google Диске..."
            index_content = "# Оригинальные источники исследования\n\n"
            index_content += f"Тема: **{refined_topic}**\n\n"
            index_content += "Ниже приведен список оригинальных ссылок, собранных для этого исследования. Вы можете скопировать их и добавить в NotebookLM как прямые ссылки.\n\n"
            
            web_links = [l for l in all_original_links if l["type"] in ["documentation", "article"]]
            yt_links = [l for l in all_original_links if l["type"] == "youtube"]
            
            if web_links:
                index_content += "## Статьи и Документация\n"
                for link in web_links:
                    index_content += f"- [{link['title']}]({link['url']})\n"
                index_content += "\n"
                
            if yt_links:
                index_content += "## YouTube Видео и Расшифровки\n"
                for link in yt_links:
                    index_content += f"- [{link['title']}]({link['url']})\n"
                index_content += "\n"
                
            try:
                from backend.drive_sync import upload_text_file
                filename = "SOURCES_INDEX.md"
                upload_text_file(service, filename, index_content, topic_folder_id)
                TOPIC_TASKS[task_id]["log"].append("Создан и загружен файл SOURCES_INDEX.md с перечнем всех ссылок.")
            except Exception as index_err:
                TOPIC_TASKS[task_id]["log"].append(f"Предупреждение: не удалось загрузить SOURCES_INDEX.md ({index_err})")

        # Completed
        TOPIC_TASKS[task_id]["status"] = "completed"
        TOPIC_TASKS[task_id]["step"] = "done"
        TOPIC_TASKS[task_id]["message"] = "Синхронизация с Google Drive успешно завершена!"
        TOPIC_TASKS[task_id]["log"].append("Все источники загружены. Подключите эту папку в вашем Google NotebookLM!")
        TOPIC_TASKS[task_id]["drive_folder_link"] = f"https://drive.google.com/drive/folders/{topic_folder_id}"
        TOPIC_TASKS[task_id]["original_links"] = all_original_links
        
    except Exception as e:
        TOPIC_TASKS[task_id]["status"] = "failed"
        TOPIC_TASKS[task_id]["message"] = f"Синхронизация прервана из-за ошибки: {e}"
        TOPIC_TASKS[task_id]["log"].append(f"Критическая ошибка: {e}")

@app.get("/api/drive/auth-status")
def get_drive_auth_status():
    """
    Returns whether Google Drive credentials/tokens are set up.
    """
    return check_drive_auth_status()

@app.get("/api/topics")
def get_topics():
    """
    Returns list of already synced topics.
    """
    topics = []
    topics_dir = os.path.join(DATA_DIR, "topics")
    if not os.path.exists(topics_dir):
        return []
        
    for slug in os.listdir(topics_dir):
        path = os.path.join(topics_dir, slug)
        if os.path.isdir(path):
            metadata_path = os.path.join(path, "metadata.json")
            if os.path.exists(metadata_path):
                try:
                    with open(metadata_path, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                        topics.append(meta)
                except Exception:
                    pass
    return topics

@app.post("/api/topics/plan")
def plan_topic(request: PlanTopicRequest):
    """
    Generates research plan and candidates list. Does not download yet.
    """
    task_id = str(uuid.uuid4())
    try:
        plan = generate_plan(
            topic=request.topic,
            depth=request.depth,
            freshness=request.freshness,
            authority_boost=request.authority_boost,
            chat_history=request.chat_history,
            gemini_api_key=request.gemini_api_key,
            anthropic_api_key=request.anthropic_api_key,
            model_provider=request.model_provider
        )
        
        # Save plan in memory tasks store
        TOPIC_TASKS[task_id] = {
            "status": "pending_approval",
            "step": "plan_ready",
            "topic": request.topic,
            "refined_topic": plan.refined_topic,
            "proposed_sources": [src.model_dump() for src in plan.proposed_sources],
            "message": "План исследования готов. Ожидание утверждения источников.",
            "log": ["План исследования составлен."]
        }
        
        return {
            "task_id": task_id,
            "refined_topic": plan.refined_topic,
            "proposed_sources": plan.proposed_sources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка планирования: {e}")

class TopicChatRequest(BaseModel):
    topic: str
    message: str
    chat_history: Optional[List[Dict]] = []
    gemini_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    model_provider: Optional[str] = "gemini"

@app.post("/api/topics/chat")
def topic_chat(request: TopicChatRequest):
    """
    Pre-search chat endpoint to refine the search guidelines with Gemini.
    """
    try:
        from backend.chat import chat_pre_search
        reply = chat_pre_search(
            topic=request.topic,
            chat_history=request.chat_history,
            question=request.message,
            gemini_api_key=request.gemini_api_key,
            anthropic_api_key=request.anthropic_api_key,
            model_provider=request.model_provider
        )
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/topics/sync")
def sync_topic(request: SyncTopicRequest, background_tasks: BackgroundTasks):
    """
    Starts background sync for the approved list of sources.
    """
    task_id = request.task_id
    # Re-initialize task in memory for the sync run
    TOPIC_TASKS[task_id] = {
        "status": "pending",
        "step": "init",
        "message": "Запуск фонового процесса синхронизации...",
        "log": ["Задача отправлена в очередь на выгрузку."]
    }
    background_tasks.add_task(
        run_sync_workflow,
        task_id,
        request.topic,
        request.refined_topic,
        request.approved_sources,
        request.perplexity_api_key
    )
    return {"task_id": task_id}

@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str):
    """
    Returns task state/logs.
    """
    if task_id not in TOPIC_TASKS:
        raise HTTPException(status_code=404, detail="Task not found")
    return TOPIC_TASKS[task_id]

# CLI mode compatibility
def run_cli_workflow(topic: str):
    print(f"\n=== Планирование исследования: '{topic}' ===")
    plan = generate_plan(topic)
    print(f"Рекомендованная тема: {plan.refined_topic}")
    print("\nПредлагаемые источники:")
    for src in plan.proposed_sources:
        print(f" - [{src.type.upper()}] {src.title}")
        print(f"   Запрос: {src.query}")
        print(f"   Польза: {src.reason}\n")
        
    confirm = input("Начать синхронизацию всех источников с Google Drive? (y/n): ").strip().lower()
    if confirm != 'y':
        print("Отмена.")
        return
        
    print("\nПодключение к Google Drive...")
    try:
        service = get_drive_service()
    except Exception as e:
        print(f"Ошибка подключения: {e}")
        return
        
    root_folder_id = get_or_create_folder(service, "NotebookLM_Sources")
    topic_folder_id = get_or_create_folder(service, plan.refined_topic, parent_id=root_folder_id)
    
    print(f"Папка на Google Drive: 'NotebookLM_Sources/{plan.refined_topic}'")
    
    for src in plan.proposed_sources:
        print(f"\nСинхронизация: {src.title}...")
        def log_progress(msg):
            print(f" > {msg}")
        sync_approved_source(service, src.model_dump(), topic_folder_id, log_progress)
        
    print(f"\nВсе готово! Ссылка на папку Диска: https://drive.google.com/drive/folders/{topic_folder_id}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NotebookLM Drive Sync CLI")
    subparsers = parser.add_subparsers(dest="command", help="Commands")
    
    cli_parser = subparsers.add_parser("cli", help="Run search & sync in CLI mode")
    cli_parser.add_argument("topic", type=str, help="Research topic")
    
    serve_parser = subparsers.add_parser("serve", help="Start FastAPI web server")
    
    args = parser.parse_args()
    
    if args.command == "cli":
        run_cli_workflow(args.topic)
    elif args.command == "serve":
        print(f"Запуск веб-сервера на http://{HOST}:{PORT}")
        uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
    else:
        print(f"Параметры не заданы. Запуск веб-сервера на http://{HOST}:{PORT}")
        uvicorn.run("main:app", host=HOST, port=PORT, reload=True)
