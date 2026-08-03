from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.enums import UpgradeUnitStatus


class UpgradeUnitBase(BaseModel):
    system_name: str
    system_type: str | None = None
    status: UpgradeUnitStatus = UpgradeUnitStatus.NOT_STARTED
    completed_date: date | None = None


class UpgradeUnitCreate(UpgradeUnitBase):
    pass


class UpgradeUnitUpdate(BaseModel):
    system_name: str | None = None
    system_type: str | None = None
    status: UpgradeUnitStatus | None = None
    completed_date: date | None = None


class UpgradeUnitRead(UpgradeUnitBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    initiative_id: int
