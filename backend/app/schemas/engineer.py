from pydantic import BaseModel, ConfigDict, EmailStr


class EngineerBase(BaseModel):
    name: str
    email: EmailStr
    title: str | None = None
    active: bool = True


class EngineerCreate(EngineerBase):
    pass


class EngineerUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    title: str | None = None
    active: bool | None = None


class EngineerRead(EngineerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
