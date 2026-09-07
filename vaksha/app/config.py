import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vaksha Voice Integrity Platform"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/vaksha.db")
    MOCK_ENGINES: bool = os.getenv("MOCK_ENGINES", "0") in ("1", "true", "True")
    HF_TOKEN: str = os.getenv("HF_TOKEN", "")
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
