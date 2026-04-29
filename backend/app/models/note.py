from sqlalchemy import Column, String, Text, Enum, DateTime, JSON, func
from app.database import Base
import enum
import uuid


class NoteStatus(str, enum.Enum):
    unanalyzed = "unanalyzed"
    analyzed = "analyzed"
    discussed = "discussed"


class Note(Base):
    __tablename__ = "notes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    language_tags = Column(JSON, nullable=False, default=list)
    status = Column(Enum(NoteStatus), nullable=False, default=NoteStatus.unanalyzed)
    analysis_result = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
