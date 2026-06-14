import os
import glob
from backend.config import get_gemini_model, DATA_DIR

def read_all_topic_files(topic_slug: str) -> str:
    """
    Reads all gathered source markdown files under a topic's folders
    and returns them concatenated with clear separator headers.
    """
    topic_dir = os.path.join(DATA_DIR, "topics", topic_slug)
    combined_content = []
    
    # Subdirectories containing collected content
    subdirs = ["01_official_docs", "02_youtube_tutorials", "03_articles_and_guides"]
    
    for subdir in subdirs:
        dir_path = os.path.join(topic_dir, subdir)
        if not os.path.exists(dir_path):
            continue
            
        pattern = os.path.join(dir_path, "*.md")
        for file_path in glob.glob(pattern):
            filename = os.path.basename(file_path)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    combined_content.append(f"=== SOURCE FILE: {subdir}/{filename} ===\n{content}\n")
            except Exception as e:
                print(f"Error reading file {file_path}: {e}")
                
    return "\n\n".join(combined_content)

def generate_briefing_and_faq(topic_slug: str, topic_name: str) -> str:
    """
    Uses Gemini API to synthesize all gathered sources into a structured markdown guide.
    Saves the output to `data/topics/{topic_slug}/00_briefing_and_faq.md`.
    """
    combined_context = read_all_topic_files(topic_slug)
    if not combined_context:
        return "Нет собранных материалов для генерации обзора."
        
    model = get_gemini_model("gemini-2.5-flash")
    
    prompt = f"""
    Вы — аналитическая система NotebookLM. Ваша задача — проанализировать все предоставленные источники по теме "{topic_name}" и сгенерировать единый, подробный и структурированный документ на русском языке.
    
    Документ ДОЛЖЕН содержать следующие разделы (используйте заголовки H1 для основных разделов и H2/H3 для подразделов):
    
    1. # Обзор (Briefing)
       - Краткое введение в тему.
       - Ключевые понятия, архитектура, сфера применения.
       - Практические советы по началу работы.
       
    2. # Часто задаваемые вопросы (FAQ)
       - 5-10 подробных вопросов и ответов на основе предоставленных материалов. Каждый ответ должен быть развернутым и содержать факты из источников.
       
    3. # Руководство по изучению (Study Guide)
       - Глоссарий ключевых терминов с определениями.
       - 3-5 контрольных вопросов для самопроверки по теме.
       
    4. # Сценарий подкаста (Podcast Script)
       - Оживленный, увлекательный диалог между двумя ведущими (Маша и Макс), которые обсуждают эту тему простыми словами, с примерами и легким юмором на основе источников.
       - Формат записи:
         Маша: [реплика]
         Макс: [реплика]
         
    Важно: Базируйте свои выводы строго на предоставленных источниках. Не добавляйте внешнюю информацию, которой нет в контексте.
    
    Вот собранные источники:
    {combined_context}
    """
    
    try:
        response = model.generate_content(prompt)
        output_path = os.path.join(DATA_DIR, "topics", topic_slug, "00_briefing_and_faq.md")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(response.text)
            
        return response.text
    except Exception as e:
        print(f"Error generating summary briefing/FAQ: {e}")
        # Fallback file creation in case of API error or quota limit
        fallback_text = f"""# Обзор и FAQ: {topic_name} (Временная заглушка)

[Ошибка генерации через API: {e}]

## Обзор темы
{topic_name} — это важная область исследований. Данный обзор временно недоступен из-за ошибки сервиса генерации текста. Пожалуйста, убедитесь, что ваш `GEMINI_API_KEY` указан верно в `.env` файле и у вас есть доступ к модели.
"""
        output_path = os.path.join(DATA_DIR, "topics", topic_slug, "00_briefing_and_faq.md")
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(fallback_text)
        return fallback_text
