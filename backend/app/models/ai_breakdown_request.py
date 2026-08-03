from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AiBreakdownRequest(Base):
    """Audit log of each AI task-breakdown generation call, so a bad/odd suggestion can be
    traced back to the exact prompt/response that produced it without re-calling the LLM.
    """

    __tablename__ = "ai_breakdown_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"), nullable=False)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    model_used: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_response_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)

    initiative = relationship("Initiative")
