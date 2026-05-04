"""Automations REST API — A1..A12 engine endpoints.

Demo-friendly: every endpoint works without external services. Side effects
are simulated and tracked in the `automation_runs` audit log for the UI.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.automations import engine
from app.modules.automations.models import AutomationRule, AutomationRun
from app.shared.dependencies import require_auth

router = APIRouter(
    prefix="/automations",
    tags=["automations"],
    dependencies=[Depends(require_auth)],
)


# ── Schemas ─────────────────────────────────────────────────────────────────
class RuleOut(BaseModel):
    key: str
    name: str
    description: str
    trigger: str
    action_type: str
    delay_label: str
    enabled: bool
    sla_min: int
    fire_count: int
    last_run_at: Optional[str] = None
    last_status: Optional[str] = None


class ToggleIn(BaseModel):
    enabled: bool


class TriggerEventIn(BaseModel):
    event: str = Field(..., description="Event name, e.g. inquiry.received")
    payload: Optional[dict] = None


class RunRuleIn(BaseModel):
    payload: Optional[dict] = None


# ── Endpoints ───────────────────────────────────────────────────────────────


@router.get("/dashboard", summary="KPI dashboard for the engine")
def dashboard(db: Session = Depends(get_db)):
    engine.seed_rules(db)
    return engine.stats(db)


@router.get("/rules", summary="List all rules", response_model=list[RuleOut])
def list_rules(db: Session = Depends(get_db)):
    engine.seed_rules(db)
    rules = db.execute(select(AutomationRule).order_by(AutomationRule.key)).scalars().all()
    return [
        RuleOut(
            key=r.key, name=r.name, description=r.description,
            trigger=r.trigger, action_type=r.action_type,
            delay_label=r.delay_label, enabled=r.enabled,
            sla_min=r.sla_min, fire_count=r.fire_count or 0,
            last_run_at=r.last_run_at.isoformat() if r.last_run_at else None,
            last_status=r.last_status,
        )
        for r in rules
    ]


@router.patch("/rules/{key}/toggle", summary="Enable or disable a rule")
def toggle_rule(key: str, body: ToggleIn, db: Session = Depends(get_db)):
    r = db.execute(select(AutomationRule).where(AutomationRule.key == key)).scalar_one_or_none()
    if not r:
        raise HTTPException(404, f"Rule {key} not found")
    r.enabled = body.enabled
    db.commit()
    return {"key": key, "enabled": r.enabled}


@router.post("/rules/{key}/run", summary="Manually run one rule with a payload")
def run_one(key: str, body: RunRuleIn = Body(default_factory=RunRuleIn), db: Session = Depends(get_db)):
    try:
        return engine.run_rule(db, key, body.payload or {})
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.post("/trigger", summary="Fire an event (matches all enabled rules)")
def trigger_event(body: TriggerEventIn, db: Session = Depends(get_db)):
    runs = engine.fire_event(db, body.event, body.payload or {})
    return {"event": body.event, "fired_rules": len(runs), "runs": runs}


@router.post("/cron-tick", summary="Run the daily cron tick (J+2/J+5/J-7/J+3 sweeps)")
def cron_tick(db: Session = Depends(get_db)):
    return engine.cron_tick(db)


@router.get("/runs", summary="Run history (latest first)")
def list_runs(
    rule_key: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    stmt = select(AutomationRun).order_by(desc(AutomationRun.started_at)).limit(limit)
    if rule_key:
        stmt = stmt.where(AutomationRun.rule_key == rule_key)
    if status:
        stmt = stmt.where(AutomationRun.status == status)
    rows = db.execute(stmt).scalars().all()
    return [
        {
            "id": r.id, "rule_key": r.rule_key, "rule_name": r.rule_name,
            "trigger": r.trigger, "status": r.status, "duration_ms": r.duration_ms,
            "started_at": r.started_at.isoformat() if r.started_at else None,
            "actions_count": len((r.output or {}).get("actions", [])),
            "summary": (r.output or {}).get("summary", ""),
            "payload": r.payload, "output": r.output, "error": r.error,
        }
        for r in rows
    ]


@router.get("/runs/{run_id}", summary="Detail of one run with all actions")
def run_detail(run_id: str, db: Session = Depends(get_db)):
    r = db.execute(select(AutomationRun).where(AutomationRun.id == run_id)).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Run not found")
    return {
        "id": r.id, "rule_key": r.rule_key, "rule_name": r.rule_name,
        "trigger": r.trigger, "status": r.status, "duration_ms": r.duration_ms,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "payload": r.payload, "output": r.output, "error": r.error,
    }


@router.post("/seed-demo", summary="Seed rules + fire each event once for demo")
def seed_demo(db: Session = Depends(get_db)):
    added = engine.seed_rules(db)
    demo_payloads = [
        ("inquiry.received", {"project_name": "Honeymoon Marrakech 7D", "client_email": "lovers@example.com",
                              "owner_email": "amine@stours.ma", "project_id": "demo-inq-001"}),
        ("quote.sent", {"project_name": "Imperial Cities 11D", "client_email": "ys-travel@example.com", "project_id": "demo-q-imp"}),
        ("deal.won", {"project_name": "VIP Atlas Adventure", "client_email": "vip@example.com", "project_id": "demo-deal-vip"}),
        ("supplier_payment_due", {"supplier_name": "TBO Holidays", "amount": 4480, "project_id": "demo-prj-tbo"}),
        ("project.start_date", {"project_name": "Family Discovery 9D", "client_email": "fam@example.com", "project_id": "demo-fam"}),
        ("project.completed", {"project_name": "Sahara Experience", "client_email": "exp@example.com",
                               "pax_email": "lara@example.com", "project_id": "demo-sah"}),
        ("task.overdue", {"task_title": "Relancer Premier Tours", "owner_email": "amine@stours.ma"}),
        ("account.at_risk", {"account_name": "Travel Agency Beta"}),
        ("payment.received", {"project_name": "MICE Conference Casa", "client_email": "corp@example.com", "project_id": "demo-mice"}),
    ]
    runs = []
    for event, payload in demo_payloads:
        runs += engine.fire_event(db, event, payload)
    return {"rules_added": added, "events_fired": len(demo_payloads), "runs": len(runs)}
