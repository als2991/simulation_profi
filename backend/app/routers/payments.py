from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import logging
from app.database import get_db
from app.models import User, Payment, Package, Profession, Promocode, UserProgress
from app.schemas import PaymentCreate, PaymentResponse, PackageResponse
from app.auth import get_current_active_user
from app.payments.yukassa import yukassa_client
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


def calculate_discount(price: float, promocode: Promocode) -> float:
    """Вычисляет сумму скидки"""
    if promocode.discount_percent > 0:
        return price * promocode.discount_percent / 100
    elif promocode.discount_amount > 0:
        return min(promocode.discount_amount, price)
    return 0


@router.get("/packages", response_model=List[PackageResponse])
async def get_available_packages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить список доступных пакетов"""
    packages = db.query(Package).filter(Package.is_active == True).all()
    return packages


@router.post("/create", response_model=PaymentResponse)
async def create_payment(
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Создать платёж"""
    amount = 0
    profession_ids = []
    
    # Вычисляем сумму и список профессий
    if payment_data.package_id:
        package = db.query(Package).filter(Package.id == payment_data.package_id).first()
        if not package:
            raise HTTPException(status_code=404, detail="Package not found")
        amount = float(package.price)
        profession_ids = package.profession_ids or []
    elif payment_data.profession_id:
        profession = db.query(Profession).filter(Profession.id == payment_data.profession_id).first()
        if not profession:
            raise HTTPException(status_code=404, detail="Profession not found")
        amount = float(profession.price)
        profession_ids = [payment_data.profession_id]
    else:
        raise HTTPException(status_code=400, detail="Either package_id or profession_id required")
    
    # Проверяем промокод
    discount_amount = 0
    promocode_obj = None
    if payment_data.promocode:
        promocode_obj = db.query(Promocode).filter(
            Promocode.code == payment_data.promocode,
            Promocode.is_active == True
        ).first()
        
        if not promocode_obj:
            raise HTTPException(status_code=404, detail="Promocode not found")
        
        if promocode_obj.max_uses and promocode_obj.current_uses >= promocode_obj.max_uses:
            raise HTTPException(status_code=400, detail="Promocode usage limit exceeded")
        
        if promocode_obj.valid_until and promocode_obj.valid_until < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Promocode expired")
        
        discount_amount = calculate_discount(amount, promocode_obj)
        amount -= discount_amount
    
    # Создаём платёж
    payment = Payment(
        user_id=current_user.id,
        amount=amount,
        package_id=payment_data.package_id,
        profession_id=payment_data.profession_id,
        promocode=payment_data.promocode,
        discount_amount=discount_amount,
        status="pending"
    )
    db.add(payment)
    
    # Обновляем счётчик использования промокода
    if promocode_obj:
        promocode_obj.current_uses += 1
    
    db.commit()
    db.refresh(payment)
    
    # Создаём платёж в ЮKassa
    description = f"Оплата профессии/пакета"
    if payment_data.package_id:
        package = db.query(Package).filter(Package.id == payment_data.package_id).first()
        if package:
            description = f"Пакет: {package.name}"
    elif payment_data.profession_id:
        profession = db.query(Profession).filter(Profession.id == payment_data.profession_id).first()
        if profession:
            description = f"Профессия: {profession.name}"
    
    return_url = f"{settings.APP_URL}/payment/success?payment_id={payment.id}"
    
    try:
        yukassa_payment = yukassa_client.create_payment(
            amount=float(amount),
            description=description,
            return_url=return_url,
            metadata={
                "payment_id": payment.id,
                "user_id": current_user.id
            }
        )
        
        # Сохраняем ID платежа ЮKassa
        payment.yukassa_payment_id = yukassa_payment.get("id")
        db.commit()
        db.refresh(payment)
        
        payment_response = PaymentResponse.model_validate(payment)
        return {
            **payment_response.model_dump(),
            "confirmation_url": yukassa_payment.get("confirmation", {}).get("confirmation_url")
        }
    except Exception as e:
        # В случае ошибки возвращаем платёж без URL (для тестирования)
        return PaymentResponse.model_validate(payment)


@router.post("/webhook")
async def yukassa_webhook(request: Request, db: Session = Depends(get_db)):
    """
    Webhook для обработки уведомлений от ЮKassa
    Документация: https://yookassa.ru/developers/using-api/webhooks
    """
    try:
        data = await request.json()
        event_type = data.get("event")
        payment_object = data.get("object", {})
        
        if event_type == "payment.succeeded":
            yukassa_payment_id = payment_object.get("id")
            payment = db.query(Payment).filter(
                Payment.yukassa_payment_id == yukassa_payment_id
            ).first()
            
            if payment and payment.status != "completed":
                payment.status = "completed"
                payment.completed_at = datetime.utcnow()
                
                # Предоставляем доступ к профессиям
                profession_ids = []
                if payment.package_id:
                    package = db.query(Package).filter(Package.id == payment.package_id).first()
                    if package:
                        profession_ids = package.profession_ids or []
                elif payment.profession_id:
                    profession_ids = [payment.profession_id]
                
                # Создаём записи прогресса для каждой профессии
                user = db.query(User).filter(User.id == payment.user_id).first()
                if user:
                    for profession_id in profession_ids:
                        existing_progress = db.query(UserProgress).filter(
                            UserProgress.user_id == user.id,
                            UserProgress.profession_id == profession_id
                        ).first()
                        
                        if not existing_progress:
                            progress = UserProgress(
                                user_id=user.id,
                                profession_id=profession_id,
                                status="not_started"
                            )
                            db.add(progress)
                
                db.commit()
        
        return {"status": "ok"}
    except Exception as e:
        # Логируем ошибку, но возвращаем 200, чтобы ЮKassa не повторял запрос
        logger.error(f"Webhook error: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


@router.post("/{payment_id}/confirm")
async def confirm_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Подтвердить платёж вручную (для тестирования или если webhook не сработал)"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    if payment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Проверяем статус в ЮKassa
    if payment.yukassa_payment_id:
        try:
            yukassa_status = yukassa_client.get_payment_status(payment.yukassa_payment_id)
            if yukassa_status.get("status") == "succeeded":
                payment.status = "completed"
                payment.completed_at = datetime.utcnow()
            else:
                return {"status": "pending", "message": "Payment not completed yet"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    else:
        # Для тестирования можно подтвердить вручную
        payment.status = "completed"
        payment.completed_at = datetime.utcnow()
    
    # Предоставляем доступ к профессиям
    profession_ids = []
    if payment.package_id:
        package = db.query(Package).filter(Package.id == payment.package_id).first()
        if package:
            profession_ids = package.profession_ids or []
    elif payment.profession_id:
        profession_ids = [payment.profession_id]
    
    # Создаём записи прогресса для каждой профессии
    for profession_id in profession_ids:
        existing_progress = db.query(UserProgress).filter(
            UserProgress.user_id == current_user.id,
            UserProgress.profession_id == profession_id
        ).first()
        
        if not existing_progress:
            progress = UserProgress(
                user_id=current_user.id,
                profession_id=profession_id,
                status="not_started"
            )
            db.add(progress)
    
    db.commit()
    
    return {"status": "success", "message": "Payment confirmed"}
    
    # Предоставляем доступ к профессиям
    profession_ids = []
    if payment.package_id:
        package = db.query(Package).filter(Package.id == payment.package_id).first()
        if package:
            profession_ids = package.profession_ids or []
    elif payment.profession_id:
        profession_ids = [payment.profession_id]
    
    # Создаём записи прогресса для каждой профессии
    for profession_id in profession_ids:
        existing_progress = db.query(UserProgress).filter(
            UserProgress.user_id == current_user.id,
            UserProgress.profession_id == profession_id
        ).first()
        
        if not existing_progress:
            progress = UserProgress(
                user_id=current_user.id,
                profession_id=profession_id,
                status="not_started"
            )
            db.add(progress)
    
    db.commit()
    
    return {"status": "success", "message": "Payment confirmed"}


@router.get("/history", response_model=List[PaymentResponse])
async def get_payment_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Получить историю платежей пользователя"""
    payments = db.query(Payment).filter(Payment.user_id == current_user.id).all()
    return payments
