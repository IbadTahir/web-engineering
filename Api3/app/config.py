from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # JWT Settings
    SECRET_KEY: str = "your-secret-key-keep-it-secret"  # Will be overridden by environment variable
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Database Settings
    DATABASE_URL: str = "sqlite:///edu_platform.db"
    
    # File Upload Settings
    MAX_FILE_SIZE: int = 5_242_880  # 5MB
    ALLOWED_FILE_TYPES: list = ["pdf", "epub", "mp4", "txt"]
    UPLOAD_DIR: str = "uploads"
    
    # Gemini AI Settings
    GEMINI_API_KEY: str = ""
    GEMINI_MAX_RETRIES: int = 3
    GEMINI_TIMEOUT: int = 30
    
    # Cache Settings
    CACHE_TTL: int = 3600  # 1 hour
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
