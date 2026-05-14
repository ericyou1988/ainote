from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from app.database import get_db
from app.models.note import Note
from app.models.conversation import Conversation
from app.models.provider import AIProvider
from app.models.note import NoteStatus
from app.services.ai_service import analyze_note, chat_message, detect_content_type
from app.services.provider_service import get_current_provider
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/api/notes", tags=["analysis", "chat"])


@router.post("/{note_id}/analyze")
def analyze_note_endpoint(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if len(note.content.strip()) < 10:
        raise HTTPException(status_code=400, detail="内容太短，AI 无法有效分析")

    provider = get_current_provider(db)
    if not provider:
        raise HTTPException(status_code=400, detail="请先配置并启用 AI 服务商")

    note_id_val = note.id

    async def generate():
        from app.database import SessionLocal
        local_db = SessionLocal()
        try:
            local_note = local_db.query(Note).filter(Note.id == note_id_val).first()
            async for chunk in analyze_note(local_db, local_note, provider):
                yield chunk
        except Exception as e:
            import traceback
            local_db.rollback()
            tb = traceback.format_exc()
            print(f"ANALYZE ERROR: {type(e).__name__}: {e}\n{tb}")
            yield f"\n\n[分析失败: {type(e).__name__}: {e}]"
        finally:
            local_db.close()

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/{note_id}/chat")
def get_chat(note_id: str, db: Session = Depends(get_db)):
    conversation = db.query(Conversation).filter(Conversation.note_id == note_id).first()
    if not conversation:
        return ChatResponse(messages=[])
    return ChatResponse(messages=conversation.messages)


@router.post("/{note_id}/chat")
def send_chat(note_id: str, data: ChatRequest, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    provider = get_current_provider(db)
    if not provider:
        raise HTTPException(status_code=400, detail="请先配置并启用 AI 服务商")

    note_id_val = note.id
    user_message = data.message

    async def generate():
        from app.database import SessionLocal
        local_db = SessionLocal()
        try:
            local_note = local_db.query(Note).filter(Note.id == note_id_val).first()
            async for chunk in chat_message(local_db, local_note, provider, user_message):
                yield chunk
        except Exception as e:
            local_db.rollback()
            yield f"\n\n[对话失败: {str(e)}]"
        finally:
            local_db.close()

    return StreamingResponse(generate(), media_type="text/event-stream")
