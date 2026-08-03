from pydantic import BaseModel


class OptInRequest(BaseModel):
    engineer_id: int | None = None


class GenerateBreakdownRequest(BaseModel):
    default_owner_engineer_id: int | None = None
