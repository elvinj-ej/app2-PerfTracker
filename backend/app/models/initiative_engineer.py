from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InitiativeEngineer(Base):
    """Opt-in join table: many engineers can join an initiative. Task-level ownership
    (Task.owner_engineer_id) is separate and always single-owner.
    """

    __tablename__ = "initiative_engineers"

    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"), primary_key=True)
    engineer_id: Mapped[int] = mapped_column(ForeignKey("engineers.id"), primary_key=True)
    opted_in_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    initiative = relationship("Initiative", back_populates="engineer_links")
    engineer = relationship("Engineer", back_populates="initiative_links")
