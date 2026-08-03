from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimeEntry(Base):
    """One row per (task, ISO week). Upsert semantics: re-submitting hours for a week
    updates the existing row rather than creating a duplicate.
    """

    __tablename__ = "time_entries"
    __table_args__ = (UniqueConstraint("task_id", "week_start_date", name="uq_time_entry_task_week"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    engineer_id: Mapped[int] = mapped_column(ForeignKey("engineers.id"), nullable=False)
    week_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    fiscal_year_label: Mapped[str] = mapped_column(String(10), nullable=False)
    hours: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    task = relationship("Task", back_populates="time_entries")
    engineer = relationship("Engineer", back_populates="time_entries")
