from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.provider import AIProvider
from app.schemas import (
    ProviderCreate, ProviderUpdate, ProviderResponse, TestResult
)
from app.services.provider_service import (
    get_providers, get_current_provider, create_provider,
    update_provider, delete_provider, set_current, mask_api_key,
    test_connection as do_test_connection, encrypt_key, decrypt_key
)

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("", response_model=list[ProviderResponse])
def list_providers(db: Session = Depends(get_db)):
    providers = get_providers(db)
    result = []
    for p in providers:
        result.append(ProviderResponse(
            id=p.id,
            name=p.name,
            api_key_masked=mask_api_key(p.api_key),
            base_url=p.base_url,
            model=p.model,
            is_active=p.is_active,
            is_current=p.is_current,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))
    return result


@router.post("", response_model=ProviderResponse, status_code=201)
def create(data: ProviderCreate, db: Session = Depends(get_db)):
    provider = create_provider(db, data.name, data.api_key, data.base_url, data.model)
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        api_key_masked=mask_api_key(provider.api_key),
        base_url=provider.base_url,
        model=provider.model,
        is_active=provider.is_active,
        is_current=provider.is_current,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.put("/{provider_id}", response_model=ProviderResponse)
def update(provider_id: str, data: ProviderUpdate, db: Session = Depends(get_db)):
    provider = update_provider(db, provider_id, **data.model_dump(exclude_unset=True))
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        api_key_masked=mask_api_key(provider.api_key),
        base_url=provider.base_url,
        model=provider.model,
        is_active=provider.is_active,
        is_current=provider.is_current,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.delete("/{provider_id}", status_code=204)
def remove(provider_id: str, db: Session = Depends(get_db)):
    success = delete_provider(db, provider_id)
    if not success:
        raise HTTPException(status_code=404, detail="服务商不存在")


@router.put("/{provider_id}/toggle", response_model=ProviderResponse)
def toggle(provider_id: str, db: Session = Depends(get_db)):
    provider = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")
    provider.is_active = not provider.is_active
    if not provider.is_active:
        provider.is_current = False
    db.commit()
    db.refresh(provider)
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        api_key_masked=mask_api_key(provider.api_key),
        base_url=provider.base_url,
        model=provider.model,
        is_active=provider.is_active,
        is_current=provider.is_current,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.put("/{provider_id}/set-current", response_model=ProviderResponse)
def set_as_current(provider_id: str, db: Session = Depends(get_db)):
    provider = set_current(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")
    return ProviderResponse(
        id=provider.id,
        name=provider.name,
        api_key_masked=mask_api_key(provider.api_key),
        base_url=provider.base_url,
        model=provider.model,
        is_active=provider.is_active,
        is_current=provider.is_current,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )


@router.post("/{provider_id}/test", response_model=TestResult)
async def test(provider_id: str, db: Session = Depends(get_db)):
    provider = db.query(AIProvider).filter(AIProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="服务商不存在")
    success, message, response_time = await do_test_connection(provider)
    return TestResult(success=success, message=message, response_time_ms=response_time)


@router.post("/test-all")
async def test_all(db: Session = Depends(get_db)):
    providers = get_providers(db)
    results = []
    for p in providers:
        success, message, response_time = await do_test_connection(p)
        results.append({
            "id": p.id,
            "name": p.name,
            "success": success,
            "message": message,
            "response_time_ms": response_time,
        })
    return results
