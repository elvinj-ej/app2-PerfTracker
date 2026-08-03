import enum


class InitiativeType(str, enum.Enum):
    KBI = "KBI"
    PLATFORM = "PLATFORM"
    RECURRING_OPS = "RECURRING_OPS"


class InitiativeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    ARCHIVED = "ARCHIVED"


class Priority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Complexity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class TaskStage(str, enum.Enum):
    HLD = "HLD"
    LLD = "LLD"
    SOLUTION_DESIGN_APPROVAL = "SOLUTION_DESIGN_APPROVAL"
    NON_PROD_DEPLOYMENT = "NON_PROD_DEPLOYMENT"
    PROD_DEPLOYMENT = "PROD_DEPLOYMENT"
    OTHER = "OTHER"


class TaskStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETE = "COMPLETE"


class RecurrenceType(str, enum.Enum):
    ANNUAL = "ANNUAL"
    QUARTERLY = "QUARTERLY"
    MONTHLY = "MONTHLY"
    WEEKLY = "WEEKLY"
    AD_HOC = "AD_HOC"


class UpgradeUnitStatus(str, enum.Enum):
    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETE = "COMPLETE"
    SKIPPED = "SKIPPED"
