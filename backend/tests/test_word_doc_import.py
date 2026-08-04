import pytest

from app.models.enums import Priority
from app.services.jira_import import JiraImportError
from app.services.word_doc_import import parse_jira_word_export

_SAMPLE_HTML = """<!DOCTYPE html>
<html>
<head><title>[#ME-1] Manufacturing Execution Initiative</title></head>
<body>
<table class="tableBorder" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
        <td bgcolor="#f0f0f0" width="100%" colspan="2" valign="top">
            <h3 class="formtitle">
                [ME-1]&nbsp;<a href="https://jira.example.com/browse/ME-1">Manufacturing Execution Initiative</a>
                <span class="subText">Created: 03/Jul/24 &nbsp;Updated: 03/Aug/26</span>
            </h3>
        </td>
    </tr>
    <tr>
        <td width="20%"><b>Status:</b></td>
        <td width="80%">Define - In Progress</td>
    </tr>
</table>
<table class="grid" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
        <td bgcolor="#f0f0f0" valign="top" width="20%"><b>Type:</b></td>
        <td bgcolor="#ffffff" valign="top" width="30%">Initiative</td>
        <td bgcolor="#f0f0f0"><b>Priority:</b></td>
        <td bgcolor="#ffffff" valign="top" nowrap>Must Have</td>
    </tr>
</table>
<table class="grid" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
        <td bgcolor="#f0f0f0" width="20%" valign="top"><b>Purpose:</b></td>
        <td id="customfield_16007-1058930-value" class="value" bgcolor="#ffffff" width="80%">Deliver the ME program of works</td>
    </tr>
    <tr>
        <td bgcolor="#f0f0f0" width="20%" valign="top"><b>Opportunity:</b></td>
        <td id="customfield_16008-1058930-value" class="value" bgcolor="#ffffff" width="80%"><p><b>Why change?</b></p>
<ul><li>Reduce complexity on the shop floor.</li></ul></td>
    </tr>
    <tr>
        <td bgcolor="#f0f0f0" width="20%" valign="top"><b>Who will Benefit?:</b></td>
        <td id="customfield_16009-1058930-value" class="value" bgcolor="#ffffff" width="80%"><p><b>Change Objective</b></p>
<ul><li>Scale manufacturing operations.</li></ul></td>
    </tr>
    <tr>
        <td bgcolor="#f0f0f0" width="20%" valign="top"><b>Functional Stream:</b></td>
        <td id="customfield_14229-1058930-value" class="value" bgcolor="#ffffff" width="80%">Manufacturing</td>
    </tr>
    <tr>
        <td bgcolor="#f0f0f0" width="20%" valign="top"><b>Target start:</b></td>
        <td id="customfield_16182-1058930-value" class="value" bgcolor="#ffffff" width="80%">
            <span title="01/Jul/24"><time datetime="2024-07-01">01/Jul/24</time></span>
        </td>
    </tr>
    <tr>
        <td bgcolor="#f0f0f0" width="20%" valign="top"><b>Target end:</b></td>
        <td id="customfield_16183-1058930-value" class="value" bgcolor="#ffffff" width="80%">
            <span title="30/Jun/26"><time datetime="2026-06-30">30/Jun/26</time></span>
        </td>
    </tr>
</table>
<table cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr><td id="descriptionArea"><p>The aim is to minimise time spent on <b>non-value add tasks</b>.</p></td></tr>
</table>
</body>
</html>
"""


def test_parses_jira_number_and_title():
    parsed = parse_jira_word_export(_SAMPLE_HTML.encode())
    assert parsed.jira_number == "ME-1"
    assert parsed.title == "Manufacturing Execution Initiative"


def test_parses_dates_from_time_datetime_attribute():
    from datetime import date

    parsed = parse_jira_word_export(_SAMPLE_HTML.encode())
    assert parsed.start_date == date(2024, 7, 1)
    assert parsed.expected_delivery_date == date(2026, 6, 30)


def test_business_goal_from_purpose():
    parsed = parse_jira_word_export(_SAMPLE_HTML.encode())
    assert parsed.business_goal == "Deliver the ME program of works"


def test_moscow_priority_maps_to_our_enum():
    parsed = parse_jira_word_export(_SAMPLE_HTML.encode())
    assert parsed.priority == Priority.CRITICAL


def test_status_guess_from_in_progress_text():
    parsed = parse_jira_word_export(_SAMPLE_HTML.encode())
    assert parsed.suggested_status == "IN_PROGRESS"


def test_description_includes_main_description_and_folded_in_fields():
    parsed = parse_jira_word_export(_SAMPLE_HTML.encode())
    assert "non-value add tasks" in parsed.description
    assert "Functional Stream: Manufacturing" in parsed.description
    assert "Opportunity:" in parsed.description
    assert "Reduce complexity on the shop floor." in parsed.description
    assert "Who will Benefit?:" in parsed.description
    assert "Scale manufacturing operations." in parsed.description


def test_raises_on_missing_title():
    with pytest.raises(JiraImportError, match="Export > Word"):
        parse_jira_word_export(b"<html><body><p>Not a Jira export</p></body></html>")


def test_missing_optional_fields_do_not_error():
    minimal = """<html><body>
    <h3 class="formtitle">[ME-2]&nbsp;<a href="#">Minimal Initiative</a></h3>
    </body></html>"""
    parsed = parse_jira_word_export(minimal.encode())
    assert parsed.jira_number == "ME-2"
    assert parsed.title == "Minimal Initiative"
    assert parsed.business_goal is None
    assert parsed.start_date is None
    assert parsed.priority is None
