from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import (
    Complexity,
    InitiativeStatus,
    InitiativeType,
    Priority,
    RecurrenceType,
)


class PlatformInitiativeCategory(Base):
    """Manager-editable lookup of Platform Initiative categories (upgrades, improvements, etc.).

    Deliberately a runtime-editable table rather than a hardcoded enum so the manager can
    add new categories (e.g. a new upgrade type) without a code deploy.
    """

    __tablename__ = "platform_initiative_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_upgrade_type: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    details = relationship("PlatformInitiativeDetail", back_populates="category")


class RecurringOpsCategory(Base):
    """Manager-editable lookup of Run Operations categories (Run Patching, Run ITSCM, etc.),
    mirroring PlatformInitiativeCategory - same rationale: runtime-editable rather than a
    hardcoded enum so the manager can add new categories without a code deploy.
    """

    __tablename__ = "recurring_ops_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    details = relationship("RecurringOpsDetail", back_populates="category")


class Initiative(Base):
    """Single-table-inheritance master row for all three work categories (KBI / Platform /
    Recurring Ops). A shared master table keeps Tasks, TimeEntries, and opt-ins pointing at
    one FK regardless of type, so reporting/rollup queries never need a UNION across
    per-type tables.
    """

    __tablename__ = "initiatives"

    id: Mapped[int] = mapped_column(primary_key=True)
    type: Mapped[InitiativeType] = mapped_column(Enum(InitiativeType, name="initiative_type"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    business_goal: Mapped[str | None] = mapped_column(Text, nullable=True)
    ask: Mapped[str | None] = mapped_column(Text, nullable=True)
    jira_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    priority: Mapped[Priority | None] = mapped_column(Enum(Priority, name="priority"), nullable=True)
    complexity: Mapped[Complexity | None] = mapped_column(Enum(Complexity, name="complexity"), nullable=True)
    status: Mapped[InitiativeStatus] = mapped_column(
        Enum(InitiativeStatus, name="initiative_status"), nullable=False, default=InitiativeStatus.DRAFT
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    platform_detail = relationship(
        "PlatformInitiativeDetail", back_populates="initiative", uselist=False, cascade="all, delete-orphan"
    )
    recurring_ops_detail = relationship(
        "RecurringOpsDetail", back_populates="initiative", uselist=False, cascade="all, delete-orphan"
    )
    tasks = relationship("Task", back_populates="initiative", cascade="all, delete-orphan")
    upgrade_units = relationship("UpgradeUnit", back_populates="initiative", cascade="all, delete-orphan")
    engineer_links = relationship("InitiativeEngineer", back_populates="initiative", cascade="all, delete-orphan")


class PlatformInitiativeDetail(Base):
    __tablename__ = "platform_initiative_details"

    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"), primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("platform_initiative_categories.id"), nullable=False)

    initiative = relationship("Initiative", back_populates="platform_detail")
    category = relationship("PlatformInitiativeCategory", back_populates="details")


class RecurringOpsDetail(Base):
    __tablename__ = "recurring_ops_details"

    initiative_id: Mapped[int] = mapped_column(ForeignKey("initiatives.id"), primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("recurring_ops_categories.id"), nullable=False)
    recurrence_type: Mapped[RecurrenceType] = mapped_column(
        Enum(RecurrenceType, name="recurrence_type"), nullable=False
    )
    recurrence_interval: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    anchor_month: Mapped[int | None] = mapped_column(Integer, nullable=True)
    anchor_day: Mapped[int | None] = mapped_column(Integer, nullable=True)

    initiative = relationship("Initiative", back_populates="recurring_ops_detail")
    category = relationship("RecurringOpsCategory", back_populates="details")
