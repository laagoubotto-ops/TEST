"""Automations module — persistence of rules, events, and run history.

Two tables:

* `automation_rules`   — 12 rules (A1..A12) with toggle, threshold, last run
* `automation_runs`    — Append-only execution history (one row per fired action)

Demo mode philosophy: writes never block (all side-effects are best-effort and
errors get logged in the run row instead of raising).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.shared.models import Base, BaseMixin


class AutomationRule(Base, BaseMixin):
    """Single rule definition. Ships pre-seeded with A1..A12."""

    __tablename__ = "automation_rules"

    key: Mapped[str] = mapped_column(String(20), unique=True, index=True)  # A1..A12
    name: Mapped[str] = mapped_column(String(160))
    trigger: Mapped[str] = mapped_column(String(120), index=True)          # event name OR cron:<expr>
    description: Mapped[str] = mapped_column(Text, default="")
    action_type: Mapped[str] = mapped_column(String(80))                   # email|task|status|notify|composite
    delay_label: Mapped[str] = mapped_column(String(40), default="")       # "<1 min", "J+2", "J-7", "immediate"
    delay_hours: Mapped[int] = mapped_column(Integer, default=0)           # 0 = immediate, 48 = J+2, ...
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sla_min: Mapped[int] = mapped_column(Integer, default=1)               # SLA target in minutes
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)    # rule-specific config
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # success|skipped|error
    fire_count: Mapped[int] = mapped_column(Integer, default=0)


class AutomationRun(Base, BaseMixin):
    """Append-only log of every rule execution (success or skip)."""

    __tablename__ = "automation_runs"
    __table_args__ = (
        Index("ix_automation_runs_rule_started", "rule_key", "started_at"),
    )

    rule_key: Mapped[str] = mapped_column(String(20), index=True)
    rule_name: Mapped[str] = mapped_column(String(160))
    trigger: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="success")     # success|skipped|error
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
