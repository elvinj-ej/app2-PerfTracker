"""tasks.sprint_number, tasks.completed_at

Revision ID: 88f0375ef28c
Revises: a1c3d7e9f2b0
Create Date: 2026-09-10 00:00:00.000000

"""
from datetime import date, timedelta
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '88f0375ef28c'
down_revision: Union[str, None] = 'a1c3d7e9f2b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Mirrors app/services/sprint.py - inlined rather than imported so this migration's
# behavior stays fixed even if the service's logic changes later.
SPRINT_EPOCH = date(2026, 7, 1)
SPRINT_LENGTH_DAYS = 14
CYCLE_END = date(2027, 6, 30)


def _max_sprint_number() -> int:
    n = 1
    while True:
        start = SPRINT_EPOCH + timedelta(days=n * SPRINT_LENGTH_DAYS)
        if start > CYCLE_END:
            return n
        n += 1


def _sprint_number_for_date(d: date) -> int:
    if d < SPRINT_EPOCH:
        return 1
    n = (d - SPRINT_EPOCH).days // SPRINT_LENGTH_DAYS + 1
    return min(n, _max_sprint_number())


def _sprint_bounds(n: int) -> tuple[date, date]:
    start = SPRINT_EPOCH + timedelta(days=(n - 1) * SPRINT_LENGTH_DAYS)
    return start, start + timedelta(days=SPRINT_LENGTH_DAYS - 1)


def upgrade() -> None:
    op.add_column('tasks', sa.Column('sprint_number', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True))

    bind = op.get_bind()

    # Backfill: existing Outcomes with a delivery_date get mapped to their nearest
    # sprint, and start_date/delivery_date are overwritten to that sprint's exact
    # bounds so sprint_number stays the single source of truth going forward.
    rows = bind.execute(sa.text("SELECT id, delivery_date FROM tasks WHERE delivery_date IS NOT NULL")).fetchall()
    for task_id, delivery_date in rows:
        if isinstance(delivery_date, str):
            delivery_date = date.fromisoformat(delivery_date)
        sprint_number = _sprint_number_for_date(delivery_date)
        start, end = _sprint_bounds(sprint_number)
        bind.execute(
            sa.text(
                "UPDATE tasks SET sprint_number = :n, start_date = :start, delivery_date = :end WHERE id = :id"
            ),
            {"n": sprint_number, "start": start.isoformat(), "end": end.isoformat(), "id": task_id},
        )

    # Backfill completed_at for already-COMPLETE tasks from updated_at - the best
    # available proxy, since no completion timestamp existed before this migration.
    bind.execute(sa.text("UPDATE tasks SET completed_at = updated_at WHERE status = 'COMPLETE'"))


def downgrade() -> None:
    op.drop_column('tasks', 'completed_at')
    op.drop_column('tasks', 'sprint_number')
