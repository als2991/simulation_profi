from openai import OpenAI
from app.config import settings
from typing import Dict, Any, List
import json

client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_task(
    system_prompt: str,
    task_template: str,
    user_history: List[Dict[str, Any]] = None
) -> str:
    """
    Генерирует конкретное задание на основе шаблона и истории пользователя
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Сгенерируй задание на основе шаблона: {task_template}"}
    ]
    
    if user_history:
        messages.append({
            "role": "user",
            "content": f"История предыдущих ответов пользователя: {json.dumps(user_history, ensure_ascii=False)}"
        })
    
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=1000
    )
    
    return response.choices[0].message.content


def evaluate_answer(
    system_prompt: str,
    task_description: str,
    user_answer: str,
    task_type: str
) -> Dict[str, Any]:
    """
    Оценивает ответ пользователя и возвращает метрики и обратную связь
    """
    evaluation_prompt = f"""
Оцени ответ пользователя на задание типа "{task_type}".

Задание: {task_description}
Ответ пользователя: {user_answer}

Оцени по следующим метрикам (шкала 1-10):
- systematicity (системность)
- stress_resistance (стрессоустойчивость)
- decision_making (принятие решений)
- empathy (эмпатия)
- logic (логика)

Верни ответ в формате JSON:
{{
    "metrics": {{
        "systematicity": число,
        "stress_resistance": число,
        "decision_making": число,
        "empathy": число,
        "logic": число
    }},
    "feedback": "текст обратной связи на русском языке"
}}
"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": evaluation_prompt}
    ]
    
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.3,
        max_tokens=500,
        response_format={"type": "json_object"}
    )
    
    result = json.loads(response.choices[0].message.content)
    return result


def generate_final_report(
    system_prompt: str,
    profession_name: str,
    all_metrics: List[Dict[str, Any]],
    all_answers: List[str]
) -> str:
    """
    Генерирует финальный отчёт на основе всех ответов пользователя
    """
    report_prompt = f"""
Создай финальный отчёт для пользователя, прошедшего симуляцию профессии "{profession_name}".

Метрики по всем заданиям:
{json.dumps(all_metrics, ensure_ascii=False)}

Ответы пользователя:
{json.dumps(all_answers, ensure_ascii=False)}

Создай честный, конструктивный отчёт на русском языке, который:
1. Анализирует сильные и слабые стороны
2. Даёт конкретные рекомендации
3. Оценивает готовность к профессии
4. Указывает области для развития

Отчёт должен быть профессиональным, но понятным.
"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": report_prompt}
    ]
    
    response = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=messages,
        temperature=0.5,
        max_tokens=2000
    )
    
    return response.choices[0].message.content
