import time
from sqlalchemy.orm import Session
from app.models.provider import AIProvider
from app.config import settings
from cryptography.fernet import Fernet


def mask_api_key(key: str) -> str:
    if len(key) <= 6:
        return "***" + key[-3:]
    return key[:4] + "***" + key[-3:]


def encrypt_key(key: str) -> str:
    return Fernet(settings.ENCRYPTION_KEY.encode()).encrypt(key.encode()).decode()


def decrypt_key(encrypted: str) -> str:
    return Fernet(settings.ENCRYPTION_KEY.encode()).decrypt(encrypted.encode()).decode()


def get_providers(db: Session) -> list[AIProvider]:
    return db.query(AIProvider).all()


def get_current_provider(db: Session) -> AIProvider | None:
    return db.query(AIProvider).filter(AIProvider.is_current == True, AIProvider.is_active == True).first()


def create_provider(db: Session, name: str, api_key: str, base_url: str, model: str) -> AIProvider:
    provider = AIProvider(
        name=name,
        api_key=encrypt_key(api_key),
        base_url=base_url,
        model=model,
    )
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def update_provider(db: Session, provider_id: str, **kwargs) -> AIProvider | None:
    provider = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not provider:
        return None
    for key, value in kwargs.items():
        if key == "api_key" and value:
            value = encrypt_key(value)
        setattr(provider, key, value)
    db.commit()
    db.refresh(provider)
    return provider


def delete_provider(db: Session, provider_id: str) -> bool:
    provider = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not provider:
        return False
    db.delete(provider)
    db.commit()
    return True


def set_current(db: Session, provider_id: str) -> AIProvider | None:
    db.query(AIProvider).update({AIProvider.is_current: False})
    provider = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if provider:
        provider.is_current = True
        provider.is_active = True
        db.commit()
        db.refresh(provider)
    return provider


async def test_connection(provider: AIProvider) -> tuple[bool, str, float | None]:
    import litellm
    try:
        api_key = decrypt_key(provider.api_key)
        start = time.time()
        response = litellm.completion(
            model=provider.model,
            api_base=provider.base_url,
            api_key=api_key,
            messages=[{"role": "user", "content": "hi"}],
            max_tokens=1,
        )
        elapsed = (time.time() - start) * 1000
        return True, "连接成功", elapsed
    except Exception as e:
        return False, str(e), None
