from datetime import date

from pydantic import BaseModel


class SprintRead(BaseModel):
    number: int
    label: str
    start_date: date
    end_date: date
    is_current: bool
