from openai import OpenAI
from app.config import settings
from typing import List, Dict, Any
import json
import logging

logger = logging.getLogger(__name__)
client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_task_question(
    system_prompt: str,
    task_description: str,
    conversation_history: List[Dict[str, str]] = None
) -> str:
    """
    Генерирует вопрос/задание для пользователя на основе шаблона и истории диалога
    
    Args:
        system_prompt: Системный промпт из scenarios.system_prompt
        task_description: Описание задания из tasks.description_template
        conversation_history: История диалога [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    
    Returns:
        Сгенерированный вопрос/задание от AI
    """
    try:
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Добавляем историю диалога если есть
        if conversation_history:
            messages.extend(conversation_history)
        
        # Добавляем текущее задание
        messages.append({
            "role": "user",
            "content": task_description
        })
        
        # Debug logging
        if settings.DEBUG_OPENAI_PROMPTS:
            logger.info("=" * 80)
            logger.info("OpenAI Request - generate_task_question")
            logger.info(f"Messages: {json.dumps(messages, ensure_ascii=False, indent=2)}")
            logger.info("=" * 80)
        
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_completion_tokens=1500
        )
        
        ai_response = response.choices[0].message.content
        
        # Debug logging
        if settings.DEBUG_OPENAI_PROMPTS:
            logger.info("=" * 80)
            logger.info("OpenAI Response - generate_task_question")
            logger.info(f"Response: {ai_response}")
            logger.info("=" * 80)
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating task question: {e}", exc_info=True)
        
        # Временное решение: возвращаем задание с пометкой
        return f"[ТЕСТОВЫЙ РЕЖИМ - OpenAI недоступен]\n\n{task_description}"
        # Возвращаем сам текст задания в случае ошибки
        #return task_description


def generate_next_task_prompt(
    current_task_order: int,
    user_answer: str,
    next_task_description: str
) -> str:
    """
    Формирует промпт для следующего задания
    
    Args:
        current_task_order: Номер текущего задания
        user_answer: Ответ пользователя на текущее задание
        next_task_description: Описание следующего задания из tasks.description_template
    
    Returns:
        Сформированный промпт для user role
    """
    # Формируем промпт с ответом пользователя и следующим заданием
    prompt = f"Пользователь ответил на задание №{current_task_order}: {user_answer}\n\n{next_task_description}"
    
    return prompt


def generate_final_report(
    system_prompt: str,
    report_template: str,
    all_tasks: List[Dict[str, str]]
) -> str:
    """
    Генерирует финальный отчёт на основе всех вопросов и ответов
    
    Args:
        system_prompt: Системный промпт из scenarios.system_prompt
        report_template: Шаблон отчета из report_templates.template_text
        all_tasks: Список всех заданий и ответов [{"question": "...", "answer": "..."}]
    
    Returns:
        Финальный отчёт от AI
    """
    try:
        # Формируем текст с вопросами и ответами
        qa_text = ""
        for i, task in enumerate(all_tasks, 1):
            qa_text += f"\nВопрос №{i}:\n{task['question']}\n\n"
            qa_text += f"Ответ:\n{task['answer']}\n"
            qa_text += "-" * 80 + "\n"
        
        # Формируем финальный промпт
        user_prompt = f"{report_template}\n\n{qa_text}"
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        # Debug logging
        if settings.DEBUG_OPENAI_PROMPTS:
            logger.info("=" * 80)
            logger.info("OpenAI Request - generate_final_report")
            logger.info(f"Messages: {json.dumps(messages, ensure_ascii=False, indent=2)}")
            logger.info("=" * 80)
        
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.5,
            max_completion_tokens=3000
        )
        
        ai_response = response.choices[0].message.content
        
        # Debug logging
        if settings.DEBUG_OPENAI_PROMPTS:
            logger.info("=" * 80)
            logger.info("OpenAI Response - generate_final_report")
            logger.info(f"Response: {ai_response}")
            logger.info("=" * 80)
        
        return ai_response
        
    except Exception as e:
        logger.error(f"Error generating final report: {e}", exc_info=True)
        return "К сожалению, возникла ошибка при генерации отчёта. Пожалуйста, свяжитесь с поддержкой."
