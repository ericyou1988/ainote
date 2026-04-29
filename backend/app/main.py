from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import notes, chat, providers

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AInote", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(chat.router)
app.include_router(providers.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
