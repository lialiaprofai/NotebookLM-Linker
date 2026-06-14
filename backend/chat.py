from typing import List, Dict
from backend.config import get_gemini_model, call_claude_api
from backend.generator import read_all_topic_files

def ask_question(topic_slug: str, topic_name: str, question: str, chat_history: List[Dict[str, str]] = None, gemini_api_key: str = None, anthropic_api_key: str = None, model_provider: str = "gemini") -> str:
    """
    Answers a question about the topic using the compiled source documents as context.
    `chat_history` is a list of dicts: [{'role': 'user' | 'model', 'content': '...'}]
    """
    context = read_all_topic_files(topic_slug)
    if not context:
        return "В этой теме пока нет документов для ответов. Пожалуйста, сначала запустите сбор данных."
        
    system_instruction = f"""
    Вы — интеллектуальный чат-ассистент локального NotebookLM. Ваша задача — отвечать на вопросы пользователя по теме "{topic_name}", основываясь строго на предоставленных ниже документах-источниках.
    
    Правила ответов:
    1. Ответ должен быть точным, подробным и структурированным (используйте Markdown).
    2. Обязательно цитируйте источники в тексте. Указывайте имя файла в квадратных скобках, например `[official_overview.md]` или `[video_tutorial_1.md]`.
    3. Если ответа нет в документах, скажите: "В собранных источниках нет информации по этому вопросу". Не придумывайте факты от себя.
    
    Вот доступные документы-источники:
    {context}
    """
    
    if model_provider == "claude":
        prompt_parts = []
        if chat_history:
            for msg in chat_history:
                role_name = "User" if msg.get('role') == 'user' else "Assistant"
                prompt_parts.append(f"{role_name}: {msg.get('content')}")
        prompt_parts.append(f"User: {question}\nAssistant:")
        prompt = "\n".join(prompt_parts)
        
        try:
            return call_claude_api(prompt, system_prompt=system_instruction, api_key=anthropic_api_key)
        except Exception as e:
            print(f"Error in Claude chat: {e}")
            return f"Ошибка при получении ответа от Claude API: {e}. Проверьте ключ."
            
    # Default to Gemini
    model = get_gemini_model("gemini-flash-latest", api_key=gemini_api_key)
    
    # Construct prompt with chat history
    prompt_parts = [system_instruction, "\n--- История диалога ---"]
    
    if chat_history:
        for msg in chat_history:
            role_name = "Пользователь" if msg['role'] == 'user' else "Ассистент"
            prompt_parts.append(f"\n{role_name}: {msg['content']}")
            
    prompt_parts.append(f"\nПользователь: {question}\nАссистент:")
    
    full_prompt = "\n".join(prompt_parts)
    
    try:
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        print(f"Error in Gemini chat completion: {e}")
        return f"Ошибка при получении ответа от Gemini API: {e}. Проверьте соединение или API ключ."


def chat_pre_search(topic: str, chat_history: List[Dict[str, str]], question: str, gemini_api_key: str = None, anthropic_api_key: str = None, model_provider: str = "gemini") -> str:
    """
    Handles a pre-search interactive conversation to refine the topic and guidelines.
    """
    system_instruction = f"""
    Вы — аналитический чат-ассистент в инструменте NotebookLM Linker. Ваша единственная задача — помочь пользователю настроить направления поиска для автоматического сбора материалов по теме "{topic}".
    
    ВАЖНЫЕ ОГРАНИЧЕНИЯ И КОНТЕКСТ:
    1. Наше приложение НЕ умеет писать код, разворачивать Docker-контейнеры, настраивать n8n или создавать базы данных. Оно умеет только искать информацию на YouTube и в веб-источниках, скачивать тексты/транскрипты и сохранять их в Google Drive для последующего импорта в Google NotebookLM.
    2. Не предлагайте пользователю "написать код", "спроектировать архитектуру" или "выбрать первый шаг разработки". Фокусируйтесь исключительно на поиске информации и подборе материалов!
    3. Предлагайте конкретные темы/запросы для парсинга и сбора документов (например: руководства по API Notion, готовые шаблоны n8n на GitHub, инструкции по настройке CrewAI на VPS).
    4. Задавайте максимум один короткий и точечный вопрос за раз, чтобы уточнить, какие именно статьи, видео или документацию нужно скачать по теме.
    5. Напомните пользователю, что когда обсуждение направлений поиска завершено, он должен нажать кнопку «Начать планирование» (Start Planning) на панели управления для перехода к списку источников.
    
    ПРАВИЛА ОФОРМЛЕНИЯ И СТИЛЬ ОТВЕТА (КРИТИЧЕСКИ ВАЖНО):
    - Отвечайте максимально кратко (буквально 1-3 предложения), только по делу, без приветствий, вступлений или шаблонных вежливых фраз.
    - Категорически ЗАПРЕЩЕНО использовать выделение жирным текстом (звёздочки `**`), курсив, списки со звёздочками (`*`), маркеры, эмодзи или любые другие декоративные символы. Пишите чистым и простым текстом без лишней разметки.
    """
    
    if model_provider == "claude":
        prompt_parts = []
        if chat_history:
            for msg in chat_history:
                role_name = "User" if msg.get('role') == 'user' else "Assistant"
                prompt_parts.append(f"{role_name}: {msg.get('content')}")
        prompt_parts.append(f"User: {question}\nAssistant:")
        prompt = "\n".join(prompt_parts)
        
        try:
            return call_claude_api(prompt, system_prompt=system_instruction, api_key=anthropic_api_key)
        except Exception as e:
            print(f"Error in Claude pre-search chat: {e}")
            return f"Ошибка при получении ответа от Claude API: {e}."
            
    # Default to Gemini
    model = get_gemini_model("gemini-flash-latest", api_key=gemini_api_key)
    
    prompt_parts = [system_instruction, "\n--- История обсуждения ---"]
    
    if chat_history:
        for msg in chat_history:
            role_name = "Пользователь" if msg['role'] == 'user' else "Ассистент"
            prompt_parts.append(f"\n{role_name}: {msg['content']}")
            
    prompt_parts.append(f"\nПользователь: {question}\nАссистент:")
    
    full_prompt = "\n".join(prompt_parts)
    
    try:
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        print(f"Error in Gemini pre-search chat: {e}")
        return f"Ошибка при получении ответа от Gemini API: {e}."


