"""
Интеграция с ЮKassa для обработки платежей
Документация: https://yookassa.ru/developers/api
"""
import httpx
from typing import Optional, Dict, Any
from app.config import settings


class YukassaClient:
    def __init__(self):
        self.shop_id = settings.YUKASSA_SHOP_ID
        self.secret_key = settings.YUKASSA_SECRET_KEY
        self.base_url = "https://api.yookassa.ru/v3"
    
    def _get_headers(self) -> Dict[str, str]:
        """Получить заголовки для запросов"""
        import base64
        auth_string = f"{self.shop_id}:{self.secret_key}"
        auth_bytes = auth_string.encode('utf-8')
        auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
        
        return {
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/json",
            "Idempotence-Key": ""  # Должен быть уникальным для каждого запроса
        }
    
    def create_payment(
        self,
        amount: float,
        description: str,
        return_url: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Создать платёж в ЮKassa
        
        Args:
            amount: Сумма платежа в рублях
            description: Описание платежа
            return_url: URL для возврата после оплаты
            metadata: Дополнительные данные (payment_id, user_id и т.д.)
        
        Returns:
            Словарь с данными платежа, включая confirmation_url для редиректа
        """
        import uuid
        
        payload = {
            "amount": {
                "value": f"{amount:.2f}",
                "currency": "RUB"
            },
            "confirmation": {
                "type": "redirect",
                "return_url": return_url
            },
            "description": description,
            "capture": True,
        }
        
        if metadata:
            payload["metadata"] = metadata
        
        headers = self._get_headers()
        headers["Idempotence-Key"] = str(uuid.uuid4())
        
        # В реальном проекте здесь должен быть HTTP запрос к API ЮKassa
        # Пока возвращаем заглушку
        # async with httpx.AsyncClient() as client:
        #     response = await client.post(
        #         f"{self.base_url}/payments",
        #         json=payload,
        #         headers=headers,
        #         timeout=30.0
        #     )
        #     response.raise_for_status()
        #     return response.json()
        
        # Заглушка для разработки
        return {
            "id": f"test_payment_{uuid.uuid4()}",
            "status": "pending",
            "confirmation": {
                "confirmation_url": f"{return_url}?payment_id=test_payment"
            }
        }
    
    def get_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """
        Получить статус платежа
        
        Args:
            payment_id: ID платежа в ЮKassa
        
        Returns:
            Словарь с данными платежа и статусом
        """
        headers = self._get_headers()
        
        # В реальном проекте здесь должен быть HTTP запрос
        # async with httpx.AsyncClient() as client:
        #     response = await client.get(
        #         f"{self.base_url}/payments/{payment_id}",
        #         headers=headers,
        #         timeout=30.0
        #     )
        #     response.raise_for_status()
        #     return response.json()
        
        # Заглушка для разработки
        return {
            "id": payment_id,
            "status": "succeeded",
            "paid": True
        }


# Singleton instance
yukassa_client = YukassaClient()
