"""run ops categories, kbi ask, outcome dates

Revision ID: 6d4bf645308e
Revises: ce4ed1952544
Create Date: 2026-08-04 09:23:07.395478

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '6d4bf645308e'
down_revision: Union[str, None] = 'ce4ed1952544'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


RUN_OPS_CATEGORIES = ["Run Patching", "Run ITSCM", "Run IAM", "Run FinOps"]


def upgrade() -> None:
    op.create_table('recurring_ops_categories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )

    run_ops_categories = sa.table(
        'recurring_ops_categories',
        sa.column('name', sa.String),
        sa.column('active', sa.Boolean),
        sa.column('sort_order', sa.Integer),
    )
    op.bulk_insert(
        run_ops_categories,
        [{"name": name, "active": True, "sort_order": i + 1} for i, name in enumerate(RUN_OPS_CATEGORIES)],
    )

    op.add_column('initiatives', sa.Column('ask', sa.Text(), nullable=True))

    # category_id is added nullable first so any pre-existing recurring_ops_details rows
    # (real deployments already running this app) can be backfilled to a default category
    # before the column is tightened to NOT NULL below.
    op.add_column('recurring_ops_details', sa.Column('category_id', sa.Integer(), nullable=True))
    op.execute(
        "UPDATE recurring_ops_details SET category_id = "
        "(SELECT id FROM recurring_ops_categories WHERE name = 'Run Patching') "
        "WHERE category_id IS NULL"
    )
    with op.batch_alter_table('recurring_ops_details') as batch_op:
        batch_op.alter_column('category_id', existing_type=sa.Integer(), nullable=False)
        batch_op.create_foreign_key(
            'fk_recurring_ops_details_category_id', 'recurring_ops_categories', ['category_id'], ['id']
        )

    op.add_column('tasks', sa.Column('start_date', sa.Date(), nullable=True))
    op.add_column('tasks', sa.Column('delivery_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('tasks', 'delivery_date')
    op.drop_column('tasks', 'start_date')
    with op.batch_alter_table('recurring_ops_details') as batch_op:
        batch_op.drop_constraint('fk_recurring_ops_details_category_id', type_='foreignkey')
        batch_op.drop_column('category_id')
    op.drop_column('initiatives', 'ask')
    op.drop_table('recurring_ops_categories')
