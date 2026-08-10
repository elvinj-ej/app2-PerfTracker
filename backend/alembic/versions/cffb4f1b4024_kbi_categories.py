"""kbi categories

Revision ID: cffb4f1b4024
Revises: 6d4bf645308e
Create Date: 2026-08-10 10:17:57.952455

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'cffb4f1b4024'
down_revision: Union[str, None] = '6d4bf645308e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_RECURRENCE_VALUES = ["DAILY", "HALF_YEARLY"]


def upgrade() -> None:
    op.create_table('kbi_categories',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('active', sa.Boolean(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('name')
    )
    op.create_table('kbi_details',
    sa.Column('initiative_id', sa.Integer(), nullable=False),
    sa.Column('category_id', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['kbi_categories.id'], ),
    sa.ForeignKeyConstraint(['initiative_id'], ['initiatives.id'], ),
    sa.PrimaryKeyConstraint('initiative_id')
    )

    # kbi_details is a brand new 1:1 table, so any KBI initiative that already existed
    # before this migration has no row in it at all (not even a nullable placeholder) -
    # unlike recurring_ops_details, which already existed and just gained a column. Any
    # such pre-existing KBI would otherwise 500 the moment the API tries to read its
    # category. Give every KBI initiative without a kbi_details row a default category.
    conn = op.get_bind()
    existing_kbi_ids = [
        row[0] for row in conn.execute(sa.text("SELECT id FROM initiatives WHERE type = 'KBI'"))
    ]
    if existing_kbi_ids:
        result = conn.execute(
            sa.text(
                "INSERT INTO kbi_categories (name, description, active, sort_order) "
                "VALUES ('General', NULL, 1, 1)"
            )
        )
        default_category_id = result.lastrowid or conn.execute(
            sa.text("SELECT id FROM kbi_categories WHERE name = 'General'")
        ).scalar_one()
        for initiative_id in existing_kbi_ids:
            conn.execute(
                sa.text(
                    "INSERT INTO kbi_details (initiative_id, category_id) VALUES (:iid, :cid)"
                ),
                {"iid": initiative_id, "cid": default_category_id},
            )

    # recurrence_type gained DAILY and HALF_YEARLY. On SQLite this column is a plain
    # VARCHAR with no CHECK constraint (SQLAlchemy's Enum only renders one on dialects
    # that ask for it, and SQLite doesn't enforce VARCHAR length either way), so no DDL
    # is needed there - new values just work. Postgres uses a real native enum type and
    # needs each new value added explicitly.
    if op.get_bind().dialect.name == "postgresql":
        for value in NEW_RECURRENCE_VALUES:
            op.execute(f"ALTER TYPE recurrence_type ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Native Postgres enum values can't be dropped without recreating the type (and
    # rewriting every dependent column/constraint), which risks destroying data if any
    # row already uses DAILY/HALF_YEARLY - deliberately left as a no-op here rather than
    # attempting a lossy downgrade.
    op.drop_table('kbi_details')
    op.drop_table('kbi_categories')
