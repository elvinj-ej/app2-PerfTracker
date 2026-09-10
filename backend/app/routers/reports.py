import io
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Engineer
from app.schemas.reporting import CompletedOutcomeDetail, EngineerDashboard, FundedAskReport, MonthlyReport, TeamSummary
from app.services.excel_export import (
    build_completed_outcomes_workbook,
    build_funded_change_business_workbook,
    build_monthly_report_workbook,
)
from app.services.reporting import (
    build_engineer_completed_outcomes,
    build_engineer_dashboard,
    build_funded_change_business_report,
    build_monthly_report,
    build_team_summary,
    get_available_months,
)

router = APIRouter(tags=["reports"])

_MONTH_PATTERN = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def _validate_month(month: str) -> str:
    if not _MONTH_PATTERN.match(month):
        raise HTTPException(status_code=400, detail="month must be in YYYY-MM format")
    return month


@router.get("/api/engineers/{engineer_id}/dashboard", response_model=EngineerDashboard)
def get_engineer_dashboard(engineer_id: int, db: Session = Depends(get_db)):
    engineer = (
        db.query(Engineer)
        .options(selectinload(Engineer.initiative_links))
        .filter(Engineer.id == engineer_id)
        .first()
    )
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return build_engineer_dashboard(db, engineer)


@router.get("/api/team/summary", response_model=TeamSummary)
def get_team_summary(db: Session = Depends(get_db)):
    return build_team_summary(db)


@router.get("/api/reports/monthly/available-months", response_model=list[str])
def list_available_months(db: Session = Depends(get_db)):
    return get_available_months(db)


@router.get("/api/reports/monthly", response_model=MonthlyReport)
def get_monthly_report(month: str, db: Session = Depends(get_db)):
    _validate_month(month)
    return build_monthly_report(db, month)


@router.get("/api/reports/monthly/export")
def export_monthly_report(month: str, db: Session = Depends(get_db)):
    _validate_month(month)
    report = build_monthly_report(db, month)
    workbook_bytes = build_monthly_report_workbook(report)
    filename = f"aose-monthly-report-{month}.xlsx"
    return StreamingResponse(
        io.BytesIO(workbook_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/reports/funded-change-business", response_model=list[FundedAskReport])
def get_funded_change_business_report(db: Session = Depends(get_db)):
    return build_funded_change_business_report(db)


@router.get("/api/reports/funded-change-business/export")
def export_funded_change_business_report(db: Session = Depends(get_db)):
    report = build_funded_change_business_report(db)
    workbook_bytes = build_funded_change_business_workbook(report)
    return StreamingResponse(
        io.BytesIO(workbook_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="aose-funded-change-business.xlsx"'},
    )


def _get_engineer_or_404(db: Session, engineer_id: int) -> Engineer:
    engineer = db.get(Engineer, engineer_id)
    if engineer is None:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return engineer


@router.get("/api/engineers/{engineer_id}/reports/completed-outcomes", response_model=list[CompletedOutcomeDetail])
def get_engineer_completed_outcomes(engineer_id: int, db: Session = Depends(get_db)):
    engineer = _get_engineer_or_404(db, engineer_id)
    return build_engineer_completed_outcomes(db, engineer)


@router.get("/api/engineers/{engineer_id}/reports/completed-outcomes/export")
def export_engineer_completed_outcomes(engineer_id: int, db: Session = Depends(get_db)):
    engineer = _get_engineer_or_404(db, engineer_id)
    outcomes = build_engineer_completed_outcomes(db, engineer)
    workbook_bytes = build_completed_outcomes_workbook(engineer.name, outcomes)
    safe_name = engineer.name.replace(" ", "-")
    return StreamingResponse(
        io.BytesIO(workbook_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="aose-completed-outcomes-{safe_name}.xlsx"'},
    )
