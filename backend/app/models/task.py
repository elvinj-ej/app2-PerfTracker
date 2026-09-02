from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import TaskStage, TaskStatus


class Task(Base):
    """Shared across all three initiative types. Ownership is a single FK column
    (owner_engineer_id), never a join table, since exactly one engineer owns a task.
    """

    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sequence_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stage: Mapped[TaskStage | None] = mapped_column(Enum(TaskStage, name="task_stage"), nullable=True)
    # Nullable: an Outcome auto-created from a bulk Ask catalog upload has no owner
    # until an engineer opts into the Ask and claims it via the owner dropdown.
    owner_engineer_id: Mapped[int | None] = mapped_column(ForeignKey("engineers.id"), nullable=True)
    forecast_duration_days: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="task_status"), nullable=False, default=TaskStatus.NOT_STARTED
    )
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    initiative = relationship("Initiative", back_populates="tasks")
    owner = relationship("Engineer", back_populates="owned_tasks", foreign_keys=[owner_engineer_id])
    time_entries = relationship("TimeEntry", back_populates="task", cascade="all, delete-orphan")
