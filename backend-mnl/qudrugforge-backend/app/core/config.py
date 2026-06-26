from typing import List
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    QuDrugForge application configuration settings loader.
    Leverages pydantic-settings to automatically pull parameters from environment variables
    or a local .env configuration file.
    """
    APP_NAME: str = Field(default="Quinfosys™ QuDrugForge Backend")
    APP_ENV: str = Field(default="development")
    APP_DEBUG: bool = Field(default=True)

    API_V1_PREFIX: str = Field(default="/api/v1")

    # Database Configuration (MongoDB)
    MONGODB_URI: str = Field(default="mongodb://127.0.0.1:27017")
    MONGODB_DATABASE: str = Field(default="qudrugforge_dev")

    # Storage Configuration
    LOCAL_STORAGE_ROOT: str = Field(default="./storage")
    STORAGE_PROVIDER: str = Field(default="local")
    MAX_UPLOAD_SIZE_MB: int = Field(default=200)


    # Authentication Options
    JWT_SECRET_KEY: str = Field(default="change-this-in-development")
    JWT_ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=60)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)
    PASSWORD_BCRYPT_ROUNDS: int = Field(default=12)

    # Compute Cluster Coordinates
    Q_AI_DRUG_BASE_URL: str = Field(default="http://127.0.0.1:8000")
    Q_AI_DRUG_TIMEOUT_SECONDS: int = Field(default=30)
    Q_AI_DRUG_ENABLED: bool = Field(default=True)

    # Redis/RQ Queue Configuration
    REDIS_URL: str = Field(default="redis://127.0.0.1:6379/0")
    REDIS_SOCKET_TIMEOUT_SECONDS: float = Field(default=1.0)

    # PostgreSQL Configuration
    POSTGRES_URL: str = Field(default="postgresql://postgres:postgres@127.0.0.1:5432/qudrugforge")

    # Network / CORS Coordinates
    FRONTEND_URL: str = Field(default="http://localhost:3000")
    CORS_ORIGINS: str = Field(default="http://localhost:3000,http://127.0.0.1:3000")
    RATE_LIMIT_PER_MINUTE: int = Field(default=100)
    RATE_LIMIT_WINDOW_SECONDS: int = Field(default=60)

    # Q-AI-Drug Importer Settings
    Q_AI_DRUG_OUTPUT_ROOT: str = Field(default="../q-ai-drug/outputs")
    Q_AI_DRUG_IMPORT_ALLOW_ABSOLUTE_PATHS: bool = Field(default=False)

    # Phase 9: Experiment Dev Job Simulation Settings
    ENABLE_DEV_JOB_SIMULATION: bool = Field(default=True)
    JOB_SIMULATION_STEP_SECONDS: int = Field(default=1)

    # Phase 20.2: Q-AI-Drug Execution Mode (http, command, hybrid)
    Q_AI_DRUG_EXECUTION_MODE: str = Field(default="hybrid")

    @model_validator(mode="after")
    def validate_production_settings(self):
        if self.APP_ENV.lower() != "production":
            return self

        errors: list[str] = []
        secret = self.JWT_SECRET_KEY.strip()
        weak_secret_markers = (
            "change-this",
            "change_me",
            "test-secret",
            "dev-secret",
            "secret-key",
        )
        if len(secret) < 32 or any(marker in secret.lower() for marker in weak_secret_markers):
            errors.append("JWT_SECRET_KEY must be a non-default secret with at least 32 characters.")
        if self.APP_DEBUG:
            errors.append("APP_DEBUG must be false in production.")
        if self.PASSWORD_BCRYPT_ROUNDS < 12:
            errors.append("PASSWORD_BCRYPT_ROUNDS must be at least 12 in production.")
        if self.ENABLE_DEV_JOB_SIMULATION:
            errors.append("ENABLE_DEV_JOB_SIMULATION must be false in production.")
        if self.Q_AI_DRUG_EXECUTION_MODE.lower() not in {"http", "command", "hybrid"}:
            errors.append("Q_AI_DRUG_EXECUTION_MODE must be one of: http, command, hybrid.")
        if (
            "postgres:postgres@" in self.POSTGRES_URL
            or "qai_dev_password" in self.POSTGRES_URL
            or "change_me" in self.POSTGRES_URL.lower()
        ):
            errors.append("POSTGRES_URL must not use default development credentials in production.")
        if "*" in self.CORS_ORIGINS:
            errors.append("CORS_ORIGINS must not contain '*' in production.")
        if self.RATE_LIMIT_PER_MINUTE <= 0 or self.RATE_LIMIT_WINDOW_SECONDS <= 0:
            errors.append("Rate limit settings must be positive integers.")
        if errors:
            raise ValueError("Invalid production configuration: " + " ".join(errors))

        return self


    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origin strings into standard list coordinates."""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Pydantic v2 modern model configuration block
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

# Instantiate the singular global settings container
settings = Settings()
