"""tasks.jira_number

Revision ID: 1a7674214a32
Revises: f44258bc0758
Create Date: 2026-11-10 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1a7674214a32'
down_revision: Union[str, None] = 'f44258bc0758'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('jira_number', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'jira_number')
