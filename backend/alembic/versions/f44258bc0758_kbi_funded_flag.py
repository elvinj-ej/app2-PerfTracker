"""kbi_details.funded

Revision ID: f44258bc0758
Revises: 88f0375ef28c
Create Date: 2026-09-10 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f44258bc0758'
down_revision: Union[str, None] = '88f0375ef28c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('kbi_details', sa.Column('funded', sa.Boolean(), nullable=False, server_default=sa.false()))
    with op.batch_alter_table('kbi_details') as batch_op:
        batch_op.alter_column('funded', server_default=None)


def downgrade() -> None:
    op.drop_column('kbi_details', 'funded')
