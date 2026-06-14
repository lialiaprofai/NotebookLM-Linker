import json
from typing import List
from pydantic import BaseModel, Field
from backend.config import get_gemini_model

class ProposedSource(BaseModel):
    id: str = Field(description="A unique short alphanumeric identifier, e.g. 'doc_intro', 'yt_tutorial_1'.")
    title: str = Field(description="A descriptive, user-friendly title of the source (in Russian).")
    query: str = Field(description="The specific targeted search query to find this information via Perplexity or YouTube.")
    type: str = Field(description="The type of the source: 'documentation', 'article', or 'youtube'.")
    reason: str = Field(description="A short explanation of what key information we expect to retrieve from this source (in Russian).")

class SearchPlan(BaseModel):
    refined_topic: str = Field(description="A short, refined title of the topic of research (max 10 words, in Russian). This is used as the folder name on Google Drive.")
    proposed_sources: List[ProposedSource] = Field(description="A list of distinct high-quality proposed sources to research this topic comprehensively.")

def generate_plan(topic: str, depth: str = "standard", freshness: bool = True, authority_boost: bool = True, chat_history: list = None, gemini_api_key: str = None) -> SearchPlan:
    """
    Queries Gemini API to refine the topic and return a structured list of proposed sources
    before downloading them, allowing for user approval.
    """
    model = get_gemini_model("gemini-flash-latest", api_key=gemini_api_key)
    
    # Customize count based on depth
    count_range = "10-12" if depth == "deep" else "5-7"
    
    # Customize freshness instructions
    freshness_instruction = ""
    if freshness:
        freshness_instruction = (
            "\nОбязательно добавляйте в поисковые запросы требования свежести данных "
            "(например, указание года 2025 или 2026, или ключевые слова 'latest version', 'recent updates', 'current standard') "
            "и нацеливайте поиск на информацию не старше 12-24 месяцев."
        )
    else:
        freshness_instruction = "\nСпециальных требований по свежести нет, ориентируйтесь на стабильные фундаментальные материалы."

    # Customize authority instructions
    authority_instruction = ""
    if authority_boost:
        authority_instruction = (
            "\nНацеливайте поисковые запросы на авторитетные и проверенные ресурсы "
            "(например, официальная документация проекта, GitHub репозитории, MDN Web Docs, StackOverflow, dev.to, Хабр). "
            "Используйте поисковые операторы вроде site: в query, если это необходимо для точного попадания на домен."
        )
    else:
        authority_instruction = "\nСпециальных доменных ограничений нет, можно использовать любые качественные материалы из поисковой выдачи."

    chat_context = ""
    if chat_history and len(chat_history) > 0:
        chat_context = "\nВ процессе предварительного обсуждения с пользователем были согласованы следующие акценты и направления поиска:\n"
        for msg in chat_history:
            role = "Пользователь" if msg.get('role') == 'user' else "ИИ-ассистент"
            chat_context += f"- {role}: {msg.get('content')}\n"

    prompt = f"""
    Вы — аналитический планировщик исследований. Ваша задача — разработать план поиска информации по теме: "{topic}".
    {chat_context}
    
    ПРАВИЛА ЗАПОЛНЕНИЯ JSON:
    1. Поле "refined_topic" должно быть очень кратким (не более 4-6 слов, на русском языке) и отражать только суть темы. Оно используется как название папки на Google Диске (например: "Исследование Anthropic Claude 3"). НЕ ПИШИТЕ сюда длинные тексты, планы, резюме или рассуждения!
    2. Поле "proposed_sources" должно содержать список ровно из {count_range} конкретных и разносторонних источников для сбора информации по теме. Это поле ОБЯЗАТЕЛЬНО должно быть заполнено!
    
    Источники должны включать:
    1. Официальную документацию, спецификации, API гайды ('documentation').
    2. Аналитические обзоры, сравнения, статьи на Хабре/Medium ('article').
    3. Видеоуроки, обзоры или лекции на YouTube ('youtube').
    {freshness_instruction}
    {authority_instruction}
    
    Для каждого источника укажите точный поисковый запрос (query) на английском или русском языке (в зависимости от того, как эффективнее искать) и обоснуйте пользу этого источника на русском языке.
    """
    
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": SearchPlan,
            }
        )
        data = json.loads(response.text)
        return SearchPlan(**data)
    except Exception as e:
        print(f"Error generating plan: {e}. Raw response: {response.text if 'response' in locals() else ''}")
        # Return a fallback plan
        return SearchPlan(
            refined_topic=topic,
            proposed_sources=[
                ProposedSource(
                    id="doc_official",
                    title="Официальная документация и руководства",
                    query=f"{topic} official documentation getting started",
                    type="documentation",
                    reason="Содержит фундаментальные основы и базовые концепции от создателей технологии."
                ),
                ProposedSource(
                    id="article_guide",
                    title="Руководства и статьи сообщества",
                    query=f"{topic} guide tutorial review",
                    type="article",
                    reason="Практический опыт разработчиков, разбор типичных ошибок и сравнения."
                ),
                ProposedSource(
                    id="yt_tutorial",
                    title="YouTube видеоурок по теме",
                    query=f"{topic} tutorial review youtube",
                    type="youtube",
                    reason="Наглядный видео-гайд с разбором кода или примеров использования."
                )
            ]
        )
