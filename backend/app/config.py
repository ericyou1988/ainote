import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = ""
    ENCRYPTION_KEY: str = ""
    APP_ENV: str = "development"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

if not settings.DATABASE_URL:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    settings.DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'data', 'ainote.db')}"

if not settings.ENCRYPTION_KEY:
    from cryptography.fernet import Fernet
    settings.ENCRYPTION_KEY = Fernet.generate_key().decode()
