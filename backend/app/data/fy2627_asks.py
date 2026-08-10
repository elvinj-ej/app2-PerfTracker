"""The Hosting & Platform team's FY26-27 Ask catalog, as supplied by the manager
(spreadsheet columns: Category - Initiative | Ask | By Date). This is the one-time real
data load used by `services/seed.py` - not sample/demo data.

Each row is `(category, ask, by_date)`:
- `category` -> column A, loaded as the category lookup for its type (Run Operations /
  Change Platform / Change Business).
- `ask` -> column B, becomes the initiative's title (see `services/seed.py` for why
  "title" and "the Ask" are treated as the same thing for this catalog).
- `by_date` -> column C, a free-text cadence/deadline hint. `services/seed.py` maps it to
  a RecurrenceType for Run Operations rows, or a concrete FY26-27 date for Change rows.

Section-header rows ('RUN', 'CHANGE PLATFORM', 'CHANGE BUSINESS'), blank rows, and the
trailing TOTAL/OTHERS notes at the bottom of the sheet are not represented here - only
rows with a real Ask in column B made it into these lists.
"""

RUN_ROWS = [
    ("People", "Mandatory Cochlear Academy courses completed successfully", "By end of quarter"),
    ("Run Observability", "Triage HPD Platform events, assess impact and remediate", "By end of day"),
    ("Run (M)I/SR", "Process (Major) Incident, Incident and Service Requests", "By end of month"),
    ("Run Patching", "Monthly - Windows OS patching", "By end of month"),
    ("Run Patching", "Monthly - RHEL OS patching", "By end of month"),
    ("Run Patching", "Monthly - SQL DB patching", "By end of month"),
    ("Run Patching", "Monthly - PostgreSQL DB patching", "By end of month"),
    ("Run Patching", "Quarterly - Storage Array Firmware patching/upgrading", "By end of quarter"),
    ("Run Patching", "Quarterly - Platform patching/upgrading", "By end of quarter"),
    ("Run Patching", "Quarterly - Java, JRE, and SDK patching", "By end of quarter"),
    ("Run Patching", "Quarterly - UPS Firmware & Management cards patching", "By end of quarter"),
    ("Run Patching", "Quarterly - VMware VM Hardware & Tools Update", "By end of quarter"),
    ("Run Patching", "Quarterly - AWS SPLUNK (shared services accounts)", "By end of quarter"),
    ("Run Patching", "Quarterly - AWS Git runners (MES, ...which account)", "By end of quarter"),
    ("Run ITSCM", "Quarterly - Support  Domains/App teams on DR Tests", "By end of quarter"),
    ("Run ITSCM", "Quarterly - Perform Restore Tests", "By end of quarter"),
    ("Run ITSCM", "Half Year DR Hosting Platform Testing", "By end of half year"),
    ("Run Deploy", "Half Year maintenance of OS / OnPrem Terraform Deployment Platform", "By end of half year"),
    ("Run Deploy", "Half Year maintenance of OS / AWS EC2 Terraform Deployment Platform", "By end of half year"),
    ("Run IAM", "Half Year Update Infrastructure Password Reset", "By end of half year"),
    ("Run IAM", "Half Year Access review of Hosting Platforms", "By end of half year"),
    ("Run IAM", "Annual review Equinix Datacenter room access", "By end of year"),
    ("Run ITAM", "Annual renew of maintenance support contracts", "By end of year"),
    ("Run FinOps", "Monthly PO Out, invoice receipting and reconciliation", "By end of month"),
    ("Run FinOps", "Quarterly - PO Out, invoice receipting and reconciliation", "By end of quarter"),
    ("Run FinOps", "Annual - PO Out, invoice receipting and reconciliation", "By end of year"),
    ("Run FinOps", "Cost control - Equinix DC", "By end of month"),
    ("Run FinOps", "Cost control - AWS Hosting", "By end of month"),
    ("Run FinOps", "Cost control - OnPrem Hosting", "By end of month"),
]

PLATFORM_ROWS = [
    (
        "Change Platform - Security review",
        "Onboard all HPD platforms to SailPoint (for annual privileged-access review and enforce MFA)",
        "By end of year",
    ),
    ("Change Platform - AWS", "Enhance AWS platform & FinOps controls", None),
    ("Change Platform - AWS EKS Managed Service", "Ensure ASW EKS Manages Services", None),
    (
        "Change Platform - AWS ControlTower",
        "Bring AWS Control Tower,SCP, Bootstrapping into CIS AWS Foundations Benchmark (L1) compliance, Security-approved",
        None,
    ),
    ("Change Platform - AWS Identity", "Set IAM (roles,…) standard and ensure complaince across all account", None),
    ("Change Platform - AWS Agents", "DevOps, SecOps, FinOps agent deployment", None),
    ("Change Platform - AWS Lzone v1", "Retirement of AWS LZv1.0 (Olingo, MIP, Clinical Cloud)", None),
    ("Change Platform - AWS Vulnerability", "Work with Mary and Domains to reduce AWS Vulnerabilities", None),
    ("Change Platform - AWS Patterns", "Set-up and deploy patterns for items as Self-serve, …", None),
    ("Change Platform - UPS", "UPS Assessment & Cable Schema Standardization", None),
    ("Change Platform - UPS", "Refresh UPSes", "By end of year"),
    ("Change Platform - OS WINDOWS", "Update of Windows 2016 & 2019 Servers to 2025", None),
    ("Change Platform - OS RHEL", "Update of RHEL v7 & v8 Servers to RHEL v9", None),
    ("Change Platform - OS WINDOWS", "Enable Live Patching on Windows Server 2025", None),
    ("Change Platform - OS RHEL", "Enable Live Patching on RHEL 9", "By end of quarter"),
    ("Change Platform - OS RHEL", "Ensure security, hardening on RHEL v8 / v9. Revalidate CIS v2", "By end of quarter"),
    ("Change Platform - SQL", "Deploy MS-SQL 2025 (CIS-compliant, IaC-based)", "By end of quarter"),
    ("Change Platform - SQL", "Upgrade 2016, 2019,2022 to 2025 SQL", "By end of year"),
    ("Change Platform - VMWare", "Upgrde vCenter to 9", None),
    ("Change Platform - VMWare", "Ensure VMWare CISv2 compliance", None),
    ("Change Platform - VMWare", "Re-asses security options. E.g. Microsegmentation on Vmware (vDefender, NSX, …)", None),
    ("Change Platform - VMWare", "Enable Live Patching on Vmware 8/9", None),
    ("Change Platform - VMWare", "Serverless Offices - Retirement of HW", None),
    ("Change Platform - VMWare", "Right-size VMware estate ahead of Jun-27 renewal", None),
    ("Change Platform - File Services", "Serverless Offices - File Server consilation / Retirement of HW", None),
    ("Change Platform - File Services", "Reduce unstructured-data footprint (MS-File, Domino, M365)", None),
    ("Change Platform - Backup processes", "Update long-term retention policy", None),
    ("Change Platform - CommVault", "Modernization App-restore (DR) testing using Commvault Cleanroom DR PoC", None),
    (
        "Change Platform - CommVault",
        "Evaluate immutable-data restore: AWS vs Azure (RTO/RPO/TCO) - seek guidance from CISO",
        None,
    ),
    (
        "Change Platform - CommVault",
        "Validate all Apps/Tiers can be restored as per policy. Ensure MS Entra and MS InTune is protected by CommVault",
        "By end of quarter",
    ),
    ("Change Platform - CommVault", 'Evaluate "updating immutability policy from weekly to daily"', None),
]

# The last two BUSINESS_ROWS entries carry a sub-detail note in column C instead of a
# date phrase (e.g. "ChengDu Go Live") - kept as `by_date` here and folded into the
# description rather than parsed as a deadline; see `_parse_by_date()` in seed.py.
BUSINESS_ROWS = [
    ("Change Business - Audits", "Ensure Audit and compliance readiness. Join Audits", None),
    ("Change Business - Data Regionalisation Program (VA)", "CNA project deployments", None),
    ("Change Business - Amplify", "Amplify Go Live, incl all integrations and refreshes", "By Feb"),
    ("Change Business - Amplify", "MES Ignition platform", None),
    ("Change Business - Amplify", "CUPs Modernization Solaris to RHEL", "Move ERP/S4Hana printers to CUPS"),
    ("Change Business - Amplify", "Manufacturing Execution Initiative", "ChengDu Go Live"),
    ("Change Business - Amplify", "Retire SuperCluster & T7s by moving it to T8", None),
    ("Change Business - Amplify", "Amplify - SimpleMDG", None),
    ("Change Business - Amplify", "[AMP] AventX replatforming", None),
    ("Change Business - Amplify", "[AMP] Vertex implementation", None),
    ("Change Business - Amplify", "[AMP] Cygnet implementation", None),
    ("Change Business - Amplify", "[AMP] Datasphere implementation to SONAR", None),
    ("Change Business - Amplify", "[AMP] India-SAP Data Sovereignty", None),
    ("Change Business - Clark", "Clark Release 5", None),
    ("Change Business - MFG", "MFG Network Micro-segmentation Initiative", None),
    ("Change Business - MFG", "MFG CBO - Mycronic Pick and Place", None),
    ("Change Business - MFG", "MFG CBO - New Pick and Place machine setup (FUJI NXTRS)", None),
    ("Change Business", "Sales Customer 360", None),
    ("Change Business", "Digital Concierge", None),
    ("Change Business", "Project Velocity: Ingesting AWS Contact Center data to Sonar", None),
    ("Change Business", "Confirm with Neurelec if backup policy must include Neurelec-based applications.", None),
    ("Change Business", "Project Go Live - e.g. WindChill upgrade v13", None),
    (
        "Change Business Hosting Private-Cloud Strategy",
        "Define Hosting strategy for workload currently hosted on Prem & 5-year roadmap",
        None,
    ),
    (
        "Change Business Hosting AWS-Cloud Strategy",
        "Define Hosting strategy for workload currently hosted on AWS & 5-year roadmap",
        None,
    ),
]
