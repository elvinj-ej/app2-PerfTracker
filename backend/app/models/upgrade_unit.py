from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import UpgradeUnitStatus


class UpgradeUnit(Base):
    """A single server/system targeted by an upgrade-category Platform Initiative.
    Completion of these units drives the initiative's overall completion % (see
    services/completion.py), overriding the generic task-based formula.
    """

    __tablename__ = "upgrade_units"

    id: Mapped[int] = mapped_column(primary_key=True)
    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"), nullable=False)
    system_name: Mapped[str] = mapped_column(String(200), nullable=False)
    system_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[UpgradeUnitStatus] = mapped_column(
        Enum(UpgradeUnitStatus, name="upgrade_unit_status"), nullable=False, default=UpgradeUnitStatus.NOT_STARTED
    )
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    initiative = relationship("Initiative", back_populates="upgrade_units")
