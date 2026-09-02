"""tasks.owner_engineer_id nullable

Revision ID: a1c3d7e9f2b0
Revises: cffb4f1b4024
Create Date: 2026-09-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1c3d7e9f2b0'
down_revision: Union[str, None] = 'cffb4f1b4024'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # An Outcome auto-created by the bulk Ask catalog upload has no owner until an
    # engineer opts in and claims it - so exactly-one-owner is no longer guaranteed.
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.alter_column('owner_engineer_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('tasks') as batch_op:
        batch_op.alter_column('owner_engineer_id', existing_type=sa.Integer(), nullable=False)
