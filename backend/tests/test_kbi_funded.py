from app.core.auth_context import Actor
from app.models import KbiCategory
from app.routers.kbi import create_kbi, update_kbi
from app.schemas.initiative import KbiCreate, KbiUpdate

MANAGER = Actor(role="manager", engineer_id=None)


def _make_category(db_session) -> KbiCategory:
    category = KbiCategory(name="Amplify")
    db_session.add(category)
    db_session.flush()
    return category


def test_create_kbi_defaults_to_unfunded(db_session):
    category = _make_category(db_session)

    kbi = create_kbi(KbiCreate(title="Ask", category_id=category.id), db=db_session, actor=MANAGER)

    assert kbi.funded is False


def test_create_kbi_can_be_marked_funded(db_session):
    category = _make_category(db_session)

    kbi = create_kbi(KbiCreate(title="Ask", category_id=category.id, funded=True), db=db_session, actor=MANAGER)

    assert kbi.funded is True


def test_update_kbi_toggles_funded(db_session):
    category = _make_category(db_session)
    kbi = create_kbi(KbiCreate(title="Ask", category_id=category.id), db=db_session, actor=MANAGER)

    updated = update_kbi(kbi.id, KbiUpdate(funded=True), db=db_session, actor=MANAGER)

    assert updated.funded is True
