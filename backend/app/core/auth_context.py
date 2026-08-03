"""Actor resolution for the v1 lightweight role switcher (no real auth yet).

Every router depends on get_current_actor() rather than reading request headers
directly. Swapping in real auth later (session cookie, JWT, SSO) means rewriting the
body of this one function to derive an Actor from the real credential - no router code
needs to change.
"""

from dataclasses import dataclass
from typing import Literal

from fastapi import Header, HTTPException

Role = Literal["manager", "engineer"]


@dataclass
class Actor:
    role: Role
    engineer_id: int | None


def get_current_actor(
    x_actor_role: Role = Header(..., alias="X-Actor-Role"),
    x_actor_engineer_id: int | None = Header(None, alias="X-Actor-Engineer-Id"),
) -> Actor:
    if x_actor_role == "engineer" and x_actor_engineer_id is None:
        raise HTTPException(status_code=400, detail="X-Actor-Engineer-Id is required when X-Actor-Role is 'engineer'")
    return Actor(role=x_actor_role, engineer_id=x_actor_engineer_id if x_actor_role == "engineer" else None)


def require_manager(actor: Actor) -> None:
    if actor.role != "manager":
        raise HTTPException(status_code=403, detail="This action requires the manager role")
