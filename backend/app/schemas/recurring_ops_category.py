from pydantic import BaseModel, ConfigDict


class RecurringOpsCategoryBase(BaseModel):
    name: str
    description: str | None = None
    active: bool = True
    sort_order: int = 0


class RecurringOpsCategoryCreate(RecurringOpsCategoryBase):
    pass


class RecurringOpsCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    sort_order: int | None = None


class RecurringOpsCategoryRead(RecurringOpsCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
