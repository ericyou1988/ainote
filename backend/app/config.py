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
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
    if os.path.exists(env_path):
        # .env exists but ENCRYPTION_KEY not loaded — reload with explicit path
        settings.__init__(_env_file=env_path)
    if not settings.ENCRYPTION_KEY:
        settings.ENCRYPTION_KEY = Fernet.generate_key().decode()
        # Persist key to .env file
        os.makedirs(os.path.dirname(env_path), exist_ok=True)
        with open(env_path, 'a') as f:
            f.write(f'\nENCRYPTION_KEY={settings.ENCRYPTION_KEY}\n')
