from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./perftracker.db"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    cors_origins: str = "http://localhost:5173"
    static_dir: str = "static"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
