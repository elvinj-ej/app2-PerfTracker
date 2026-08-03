import pytest

from app.models.enums import Priority
from app.services.jira_import import JiraImportError, parse_jira_issue_xml

_SAMPLE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="0.92">
  <channel>
    <title>Jira</title>
    <item>
      <title>[ME-1] Manufacturing Execution Initiative</title>
      <link>https://cltd-jira.cochlear.com/browse/ME-1</link>
      <project id="10000" key="ME">Manufacturing Execution</project>
      <key id="12345">ME-1</key>
      <summary>Manufacturing Execution Initiative</summary>
      <type id="7">Initiative</type>
      <priority id="1">Must Have</priority>
      <status id="3">Define - In Progress</status>
      <resolution>Unresolved</resolution>
      <assignee username="rplunkett">Rushka Plunkett</assignee>
      <reporter username="rsuen">Rosita Suen</reporter>
      <created>Wed, 3 Jul 2024 00:43:02 +0000</created>
      <updated>Mon, 3 Aug 2026 06:25:48 +0000</updated>
      <description>&lt;p&gt;The aim is to minimise time spent on &lt;b&gt;non-value add tasks&lt;/b&gt;.&lt;/p&gt;
&lt;p&gt;Second paragraph with detail.&lt;/p&gt;</description>
      <customfields>
        <customfield id="customfield_10100" key="com.atlassian:target-start">
          <customfieldname>Target start</customfieldname>
          <customfieldvalues>
            <customfieldvalue>Mon, 1 Jul 2024 00:00:00 +0000</customfieldvalue>
          </customfieldvalues>
        </customfield>
        <customfield id="customfield_10101" key="com.atlassian:target-end">
          <customfieldname>Target end</customfieldname>
          <customfieldvalues>
            <customfieldvalue>Tue, 30 Jun 2026 00:00:00 +0000</customfieldvalue>
          </customfieldvalues>
        </customfield>
        <customfield id="customfield_10102" key="com.atlassian:purpose">
          <customfieldname>Purpose</customfieldname>
          <customfieldvalues>
            <customfieldvalue>Deliver the ME program of works</customfieldvalue>
          </customfieldvalues>
        </customfield>
        <customfield id="customfield_10103" key="com.atlassian:rank">
          <customfieldname>CCOG Rank</customfieldname>
          <customfieldvalues>
            <customfieldvalue>1000.0</customfieldvalue>
          </customfieldvalues>
        </customfield>
      </customfields>
      <issuelinks>
        <issuelinktype>
          <name>Blocks</name>
          <outwardlinks description="blocks">
            <issuelink>
              <issuekey id="20001">ME-2</issuekey>
            </issuelink>
            <issuelink>
              <issuekey id="20002">ME-3</issuekey>
            </issuelink>
          </outwardlinks>
        </issuelinktype>
      </issuelinks>
    </item>
  </channel>
</rss>
"""


def test_parses_key_summary_and_dates():
    parsed = parse_jira_issue_xml(_SAMPLE_XML.encode())
    assert parsed.jira_number == "ME-1"
    assert parsed.title == "Manufacturing Execution Initiative"
    from datetime import date

    assert parsed.start_date == date(2024, 7, 1)
    assert parsed.expected_delivery_date == date(2026, 6, 30)


def test_strips_html_from_description():
    parsed = parse_jira_issue_xml(_SAMPLE_XML.encode())
    assert parsed.description is not None
    assert "<p>" not in parsed.description
    assert "<b>" not in parsed.description
    assert "non-value add tasks" in parsed.description
    assert "Second paragraph with detail." in parsed.description


def test_business_goal_from_purpose_custom_field():
    parsed = parse_jira_issue_xml(_SAMPLE_XML.encode())
    assert parsed.business_goal == "Deliver the ME program of works"


def test_moscow_priority_maps_to_our_enum():
    parsed = parse_jira_issue_xml(_SAMPLE_XML.encode())
    assert parsed.priority == Priority.CRITICAL


def test_status_guess_from_in_progress_text():
    parsed = parse_jira_issue_xml(_SAMPLE_XML.encode())
    assert parsed.suggested_status == "IN_PROGRESS"


def test_counts_but_does_not_import_linked_issues():
    parsed = parse_jira_issue_xml(_SAMPLE_XML.encode())
    assert parsed.skipped_linked_issues == 2


def test_falls_back_to_opportunity_when_purpose_missing():
    xml = _SAMPLE_XML.replace(
        "<customfieldname>Purpose</customfieldname>", "<customfieldname>Opportunity</customfieldname>"
    )
    parsed = parse_jira_issue_xml(xml.encode())
    assert parsed.business_goal == "Deliver the ME program of works"


def test_raises_on_missing_item_element():
    with pytest.raises(JiraImportError, match="single-issue"):
        parse_jira_issue_xml(b"<rss><channel><title>Empty</title></channel></rss>")


def test_raises_on_malformed_xml():
    with pytest.raises(JiraImportError, match="Could not parse"):
        parse_jira_issue_xml(b"<rss><channel><item><key>ME-1</key></item")


def test_rejects_external_entity_expansion():
    malicious = b"""<?xml version="1.0"?>
<!DOCTYPE rss [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<rss><channel><item><key>ME-1</key><summary>&xxe;</summary></item></channel></rss>"""
    with pytest.raises(JiraImportError):
        parse_jira_issue_xml(malicious)


def test_unrecognized_priority_leaves_it_unset():
    xml = _SAMPLE_XML.replace(">Must Have<", ">Some Custom Priority<")
    parsed = parse_jira_issue_xml(xml.encode())
    assert parsed.priority is None
