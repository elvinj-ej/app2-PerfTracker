from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./aose.db"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5"
    cors_origins: str = "http://localhost:5173"
    static_dir: str = "static"
    url_prefix: str = "/AOSE"
    # Base URL of the org's Jira instance (e.g. https://cltd-jira.cochlear.com) used for
    # live issue lookups on the Import from Jira page. The credential itself (a Personal
    # Access Token) is supplied per-request by the browser, never stored server-side -
    # this setting is just the fixed hostname, not a secret.
    jira_base_url: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
