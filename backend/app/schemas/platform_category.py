from pydantic import BaseModel, ConfigDict


class PlatformInitiativeCategoryBase(BaseModel):
    name: str
    description: str | None = None
    is_upgrade_type: bool = False
    active: bool = True
    sort_order: int = 0


class PlatformInitiativeCategoryCreate(PlatformInitiativeCategoryBase):
    pass


class PlatformInitiativeCategoryUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_upgrade_type: bool | None = None
    active: bool | None = None
    sort_order: int | None = None


class PlatformInitiativeCategoryRead(PlatformInitiativeCategoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
