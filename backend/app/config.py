from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    OPENAI_API_KEY: Optional[str] = None
    ELEVENLABS_API_KEY: Optional[str] = None
    RUNWARE_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    # "openai" (default) or "gemini" — selects which LLM provider all
    # vision-shaped calls (Quality / Scene / Sound / Continuity / Critic)
    # route through. Both providers normalize to OpenAI's response shape.
    LLM_PROVIDER: str = "openai"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
