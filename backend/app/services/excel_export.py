"""Builds the .xlsx workbooks behind the Reporting pages' "Export to Excel" buttons:
the Monthly Report, the Funded Change Business report, and an engineer's Completed
Outcomes report.
"""

import io

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from app.models.enums import InitiativeType
from app.schemas.reporting import CompletedOutcomeDetail, FundedAskReport, MonthlyInitiativeReport, MonthlyReport

CATEGORY_LABELS: dict[InitiativeType, str] = {
    InitiativeType.KBI: "Key Business Initiative",
    InitiativeType.PLATFORM: "Platform Initiative",
    InitiativeType.RECURRING_OPS: "Run Operations",
}

_HEADER_FILL = PatternFill(start_color="FF1F2937", end_color="FF1F2937", fill_type="solid")
_HEADER_FONT = Font(bold=True, color="FFFFFFFF")


def _write_header(ws: Worksheet, headers: list[str]) -> None:
    ws.append(headers)
    for cell in ws[ws.max_row]:
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL


def _autosize_columns(ws: Worksheet, column_count: int) -> None:
    for col in range(1, column_count + 1):
        letter = get_column_letter(col)
        longest = max((len(str(cell.value)) for cell in ws[letter] if cell.value is not None), default=0)
        ws.column_dimensions[letter].width = max(12, longest + 3)


def build_monthly_report_workbook(report: MonthlyReport) -> bytes:
    wb = Workbook()

    detail_ws = wb.active
    detail_ws.title = "Task Detail"
    detail_headers = ["Category", "Initiative", "Task", "Stage", "Engineer", "Status", "Hours This Month"]
    _write_header(detail_ws, detail_headers)

    engineer_totals: dict[str, dict[str, float]] = {}
    groups: list[tuple[list[MonthlyInitiativeReport], InitiativeType]] = [
        (report.kbis, InitiativeType.KBI),
        (report.platform_initiatives, InitiativeType.PLATFORM),
        (report.recurring_ops, InitiativeType.RECURRING_OPS),
    ]

    for initiatives, itype in groups:
        category_label = CATEGORY_LABELS[itype]
        for initiative in initiatives:
            for task in initiative.tasks:
                if task.hours_this_month <= 0:
                    continue
                detail_ws.append(
                    [
                        category_label,
                        initiative.title,
                        task.title,
                        task.stage.value if task.stage else "",
                        task.owner_engineer_name,
                        task.status.value,
                        round(task.hours_this_month, 2),
                    ]
                )
                bucket = engineer_totals.setdefault(task.owner_engineer_name, {})
                bucket[category_label] = bucket.get(category_label, 0.0) + task.hours_this_month

    _autosize_columns(detail_ws, len(detail_headers))

    summary_ws = wb.create_sheet("Summary by Engineer")
    category_labels = list(CATEGORY_LABELS.values())
    summary_headers = ["Engineer", *category_labels, "Total"]
    _write_header(summary_ws, summary_headers)

    for engineer_name in sorted(engineer_totals):
        totals = engineer_totals[engineer_name]
        values = [round(totals.get(label, 0.0), 2) for label in category_labels]
        summary_ws.append([engineer_name, *values, round(sum(values), 2)])

    _autosize_columns(summary_ws, len(summary_headers))

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_funded_change_business_workbook(reports: list[FundedAskReport]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Funded Change Business"
    headers = [
        "Ask",
        "Category",
        "Ask Status",
        "Expected Delivery",
        "Ask Total Hours",
        "Outcome",
        "Outcome Status",
        "Sprint",
        "Assignee",
        "Outcome Hours",
    ]
    _write_header(ws, headers)

    for report in reports:
        if not report.outcomes:
            ws.append(
                [
                    report.title,
                    report.category_name,
                    report.status,
                    report.expected_delivery_date.isoformat() if report.expected_delivery_date else "",
                    round(report.total_hours_logged, 2),
                    "",
                    "",
                    "",
                    "",
                    "",
                ]
            )
            continue
        for outcome in report.outcomes:
            ws.append(
                [
                    report.title,
                    report.category_name,
                    report.status,
                    report.expected_delivery_date.isoformat() if report.expected_delivery_date else "",
                    round(report.total_hours_logged, 2),
                    outcome.title,
                    outcome.status.value,
                    outcome.sprint_label or "Unscheduled",
                    outcome.owner_engineer_name or "Unassigned",
                    round(outcome.hours_logged, 2),
                ]
            )

    _autosize_columns(ws, len(headers))
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def build_completed_outcomes_workbook(engineer_name: str, outcomes: list[CompletedOutcomeDetail]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Completed Outcomes"
    ws.append([f"Completed Outcomes for {engineer_name}"])
    ws["A1"].font = Font(bold=True)
    ws.append([])

    headers = ["Ask", "Category", "Outcome", "Sprint", "Completed", "Hours Logged", "Forecast (days)"]
    _write_header(ws, headers)

    for outcome in outcomes:
        ws.append(
            [
                outcome.initiative_title,
                outcome.category_name,
                outcome.title,
                outcome.sprint_label or "Unscheduled",
                outcome.completed_at.date().isoformat() if outcome.completed_at else "",
                round(outcome.hours_logged, 2),
                outcome.forecast_duration_days,
            ]
        )

    _autosize_columns(ws, len(headers))
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()
