from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from typing import Optional
from app.database import get_db
from app.models.note import Note, NoteStatus
from app.models.conversation import Conversation
from app.schemas import NoteCreate, NoteUpdate, NoteResponse, NoteListResponse
from app.services.ai_service import detect_language_tags
import datetime

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("", response_model=NoteListResponse)
def list_notes(
    q: Optional[str] = Query(None),
    tags: Optional[str] = Query(None),
    sort: Optional[str] = Query("updated_at"),
    limit: int = Query(20),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    query = db.query(Note)

    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            Note.title.ilike(search_pattern) | Note.content.ilike(search_pattern)
        )

    if tags:
        tag_list = tags.split(",")
        # SQLite JSON: use json_each to check if tag exists in array
        # For multiple tags, use OR logic (any match)
        from sqlalchemy import text
        conditions = []
        for tag in tag_list:
            conditions.append(
                text(f"EXISTS (SELECT 1 FROM json_each(language_tags) WHERE value = '{tag}')")
            )
        from sqlalchemy import or_
        query = query.filter(or_(*conditions))

    order_col = Note.updated_at if sort == "updated_at" else Note.created_at
    query = query.order_by(order_col.desc())

    total = query.count()
    notes = query.offset(offset).limit(limit).all()

    return NoteListResponse(notes=notes, total=total)


@router.get("/{note_id}", response_model=NoteResponse)
def get_note(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return note


@router.post("", response_model=NoteResponse, status_code=201)
def create_note(data: NoteCreate, db: Session = Depends(get_db)):
    tags = detect_language_tags(data.content) if data.content else []
    note = Note(title=data.title, content=data.content, language_tags=tags)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.put("/{note_id}", response_model=NoteResponse)
def update_note(note_id: str, data: NoteUpdate, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if data.title is not None:
        note.title = data.title
    if data.content is not None:
        note.content = data.content
        note.language_tags = detect_language_tags(data.content) if data.content else []
    if data.language_tags is not None:
        note.language_tags = data.language_tags

    note.updated_at = datetime.datetime.now()
    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: str, db: Session = Depends(get_db)):
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # Delete related conversations
    db.query(Conversation).filter(Conversation.note_id == note_id).delete()
    db.delete(note)
    db.commit()


@router.get("/{note_id}/export")
def export_note(note_id: str, format: str = "md", db: Session = Depends(get_db)):
    from fastapi.responses import PlainTextResponse

    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if format == "txt":
        content = f"{note.title}\n\n{note.content}"
    else:
        content = f"# {note.title}\n\n{note.content}"

    filename = f"{note.title}.{'md' if format == 'md' else 'txt'}"
    return PlainTextResponse(content=content, headers={
        "Content-Disposition": f'attachment; filename="{filename}"'
    })
