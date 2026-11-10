"""Builds the .xlsx workbooks behind the Reporting pages' "Export to Excel" buttons:
the Monthly Report, the Funded Change Business report, and an engineer's Completed
Outcomes report.
"""

import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.marker import DataPoint
from openpyxl.chart.shapes import GraphicalProperties
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

# Matches the categorical series colors used for these three types in the app's own
# charts (frontend/src/index.css --series-kbi/--series-platform/--series-recurring),
# so a chart looks the same whether viewed in AOSE or in the exported workbook.
CATEGORY_COLORS: dict[InitiativeType, str] = {
    InitiativeType.KBI: "2A78D6",
    InitiativeType.PLATFORM: "EB6834",
    InitiativeType.RECURRING_OPS: "1BAF7A",
}

_HEADER_FILL = PatternFill(start_color="FF1F2937", end_color="FF1F2937", fill_type="solid")
_HEADER_FONT = Font(bold=True, color="FFFFFFFF")


def _format_month_label(month: str) -> str:
    return datetime.strptime(month, "%Y-%m").strftime("%B %Y")


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


def _colored_bar_chart(
    *, title: str, y_title: str, data_ref: Reference, cats_ref: Reference, colors: list[str], height: float, width: float
) -> BarChart:
    chart = BarChart()
    chart.type = "col"
    chart.style = 10
    chart.title = title
    chart.y_axis.title = y_title
    chart.x_axis.title = None
    chart.height = height
    chart.width = width
    chart.legend = None
    chart.add_data(data_ref, titles_from_data=True)
    chart.set_categories(cats_ref)
    series = chart.series[0]
    series.data_points = [DataPoint(idx=i, spPr=GraphicalProperties(solidFill=color)) for i, color in enumerate(colors)]
    return chart


def build_monthly_report_workbook(report: MonthlyReport) -> bytes:
    wb = Workbook()
    month_label = _format_month_label(report.month)

    groups: list[tuple[list[MonthlyInitiativeReport], InitiativeType]] = [
        (report.kbis, InitiativeType.KBI),
        (report.platform_initiatives, InitiativeType.PLATFORM),
        (report.recurring_ops, InitiativeType.RECURRING_OPS),
    ]

    # --- Overview: KPIs + charts, for a quick exec-level read of the month ---
    overview_ws = wb.active
    overview_ws.title = "Overview"
    overview_ws["A1"] = f"Monthly Report — {month_label}"
    overview_ws["A1"].font = Font(bold=True, size=16)
    overview_ws["A3"] = "Total hours logged"
    overview_ws["B3"] = round(report.total_hours_this_month, 1)
    overview_ws["A4"] = "Asks with time logged this month"
    overview_ws["B4"] = report.active_ask_count
    for cell in ("A3", "A4"):
        overview_ws[cell].font = Font(bold=True)

    overview_ws["A6"] = "Hours by Category"
    overview_ws["A6"].font = Font(bold=True, size=12)
    cat_header_row = 7
    overview_ws.cell(row=cat_header_row, column=1, value="Category")
    overview_ws.cell(row=cat_header_row, column=2, value="Hours")
    for col in (1, 2):
        c = overview_ws.cell(row=cat_header_row, column=col)
        c.font = _HEADER_FONT
        c.fill = _HEADER_FILL
    cat_colors: list[str] = []
    for i, c in enumerate(report.hours_by_category):
        row = cat_header_row + 1 + i
        overview_ws.cell(row=row, column=1, value=CATEGORY_LABELS[c.initiative_type])
        overview_ws.cell(row=row, column=2, value=round(c.hours, 1))
        cat_colors.append(CATEGORY_COLORS[c.initiative_type])
    cat_last_row = cat_header_row + len(report.hours_by_category)
    _autosize_columns(overview_ws, 2)

    if report.hours_by_category:
        cat_chart = _colored_bar_chart(
            title="Hours by Category",
            y_title="Hours",
            data_ref=Reference(overview_ws, min_col=2, min_row=cat_header_row, max_row=cat_last_row),
            cats_ref=Reference(overview_ws, min_col=1, min_row=cat_header_row + 1, max_row=cat_last_row),
            colors=cat_colors,
            height=7.5,
            width=12,
        )
        overview_ws.add_chart(cat_chart, "D6")

    # Top Asks by hours this month, across all three categories - capped for a readable
    # chart; the full, uncapped list lives in the "Ask Summary" sheet below.
    all_active: list[tuple[str, InitiativeType, float]] = [
        (initiative.title, itype, initiative.total_hours_this_month) for initiatives, itype in groups for initiative in initiatives
    ]
    all_active.sort(key=lambda row: row[2], reverse=True)
    top_asks = all_active[:15]

    ask_header_row = cat_last_row + 3
    overview_ws.cell(row=ask_header_row - 1, column=1, value="Top Asks by Hours This Month").font = Font(
        bold=True, size=12
    )
    overview_ws.cell(row=ask_header_row, column=1, value="Ask")
    overview_ws.cell(row=ask_header_row, column=2, value="Hours")
    for col in (1, 2):
        c = overview_ws.cell(row=ask_header_row, column=col)
        c.font = _HEADER_FONT
        c.fill = _HEADER_FILL
    ask_colors: list[str] = []
    for i, (title, itype, hours) in enumerate(top_asks):
        row = ask_header_row + 1 + i
        overview_ws.cell(row=row, column=1, value=title)
        overview_ws.cell(row=row, column=2, value=round(hours, 1))
        ask_colors.append(CATEGORY_COLORS[itype])
    ask_last_row = ask_header_row + len(top_asks)

    if top_asks:
        ask_chart = _colored_bar_chart(
            title="Top Asks by Hours This Month",
            y_title="Hours",
            data_ref=Reference(overview_ws, min_col=2, min_row=ask_header_row, max_row=ask_last_row),
            cats_ref=Reference(overview_ws, min_col=1, min_row=ask_header_row + 1, max_row=ask_last_row),
            colors=ask_colors,
            height=11,
            width=18,
        )
        ask_chart.type = "bar"  # horizontal - more room for Ask titles than a vertical chart
        overview_ws.add_chart(ask_chart, f"D{ask_header_row - 1}")

    overview_ws.column_dimensions["A"].width = max(overview_ws.column_dimensions["A"].width or 0, 42)

    # --- Ask Summary: full raw data, one row per Ask that had time logged ---
    ask_summary_ws = wb.create_sheet("Ask Summary")
    ask_summary_headers = ["Category", "Ask", "Status", "Completion %", "Expected Delivery", "Hours This Month"]
    _write_header(ask_summary_ws, ask_summary_headers)
    for initiatives, itype in groups:
        category_label = CATEGORY_LABELS[itype]
        for initiative in sorted(initiatives, key=lambda i: i.total_hours_this_month, reverse=True):
            ask_summary_ws.append(
                [
                    category_label,
                    initiative.title,
                    initiative.status,
                    round(initiative.completion_pct, 1) if initiative.completion_pct is not None else "",
                    initiative.expected_delivery_date.isoformat() if initiative.expected_delivery_date else "",
                    round(initiative.total_hours_this_month, 2),
                ]
            )
    _autosize_columns(ask_summary_ws, len(ask_summary_headers))

    detail_ws = wb.create_sheet("Task Detail")
    detail_headers = ["Category", "Initiative", "Task", "Stage", "Engineer", "Status", "Hours This Month"]
    _write_header(detail_ws, detail_headers)

    engineer_totals: dict[str, dict[str, float]] = {}
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
