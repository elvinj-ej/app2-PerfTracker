from pydantic import BaseModel


class OptInRequest(BaseModel):
    engineer_id: int | None = None
