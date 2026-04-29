from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class NoteStatus(str, Enum):
    unanalyzed = "unanalyzed"
    analyzed = "analyzed"
    discussed = "discussed"


class NoteCreate(BaseModel):
    title: str
    content: str = ""


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    language_tags: Optional[list[str]] = None


class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    language_tags: list[str]
    status: NoteStatus
    analysis_result: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    notes: list[NoteResponse]
    total: int


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    messages: list[dict]


class ProviderCreate(BaseModel):
    name: str
    api_key: str
    base_url: str
    model: str


class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None
    is_active: Optional[bool] = None


class ProviderResponse(BaseModel):
    id: str
    name: str
    api_key_masked: str
    base_url: str
    model: str
    is_active: bool
    is_current: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestResult(BaseModel):
    success: bool
    message: str
    response_time_ms: Optional[float] = None
