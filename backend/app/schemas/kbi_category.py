from pydantic import BaseModel, ConfigDict


class KbiCategoryBase(BaseModel):
    name: str
    description: str | None = None
    active: bool = True
    sort_order: int = 0


class KbiCategoryCreate(KbiCategoryBase):
    pass


class KbiCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    sort_order: int | None = None


class KbiCategoryRead(KbiCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
