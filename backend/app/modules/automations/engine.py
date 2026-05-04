"""A1..A12 engine — runs rules deterministically against in-DB state.

Each rule is a pure function `run(db, payload) -> dict` that returns the
"output" (what was created/sent/updated). Errors are caught and logged into
`AutomationRun.error` so the dashboard surfaces them without crashing the API.

In demo mode, side effects (email send, voucher generation, task creation)
return mock identifiers prefixed with `demo-` so the UI can display them.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.automations.models import AutomationRule, AutomationRun

logger = logging.getLogger(__name__)


# ── A1..A12 rule catalog ────────────────────────────────────────────────────
RULES: list[dict[str, Any]] = [
    {
        "key": "A1", "name": "Auto-réponse demande client",
        "trigger": "inquiry.received", "delay_label": "<1 min", "delay_hours": 0,
        "action_type": "composite", "sla_min": 1,
        "description": "Email auto-réponse «devis sous 24h» + crée Project en LEAD + assigne commercial.",
    },
    {
        "key": "A2", "name": "Tâche qualification urgente",
        "trigger": "inquiry.received", "delay_label": "<1 min", "delay_hours": 0,
        "action_type": "task", "sla_min": 1,
        "description": "Crée tâche commerciale «Qualifier la demande» (priority=urgent, due=+4h).",
    },
    {
        "key": "A3", "name": "Follow-up devis J+2",
        "trigger": "quote.sent", "delay_label": "J+2", "delay_hours": 48,
        "action_type": "email", "sla_min": 5,
        "description": "Email auto «Avez-vous eu le temps de regarder ?» si pas de réponse.",
    },
    {
        "key": "A4", "name": "Follow-up devis J+5 + appel",
        "trigger": "quote.sent", "delay_label": "J+5", "delay_hours": 120,
        "action_type": "composite", "sla_min": 10,
        "description": "Email «On peut adapter» + tâche «Appeler le client» si silence > 5j.",
    },
    {
        "key": "A5", "name": "Bascule auto LOST J+10",
        "trigger": "quote.sent", "delay_label": "J+10", "delay_hours": 240,
        "action_type": "status", "sla_min": 5,
        "description": "Passe le devis en LOST (lost_reason=no_response_after_10d) + activity.",
    },
    {
        "key": "A6", "name": "Booking automatique sur deal.won",
        "trigger": "deal.won", "delay_label": "<1 min", "delay_hours": 0,
        "action_type": "composite", "sla_min": 2,
        "description": "Crée Booking + 5 tâches ops + email confirmation + voucher PDF.",
    },
    {
        "key": "A7", "name": "Rappel paiement fournisseur J-3",
        "trigger": "supplier_payment_due", "delay_label": "J-3", "delay_hours": -72,
        "action_type": "composite", "sla_min": 5,
        "description": "Tâche finance «Payer fournisseur» + email rappel 3j avant échéance.",
    },
    {
        "key": "A8", "name": "Email pré-départ J-7",
        "trigger": "project.start_date", "delay_label": "J-7", "delay_hours": -168,
        "action_type": "email", "sla_min": 5,
        "description": "Email pré-départ au client B2B avec dossier voyage complet.",
    },
    {
        "key": "A9", "name": "Enquête NPS J+3",
        "trigger": "project.completed", "delay_label": "J+3", "delay_hours": 72,
        "action_type": "email", "sla_min": 5,
        "description": "Email NPS au contact principal + au passager principal après fin de voyage.",
    },
    {
        "key": "A10", "name": "Alerte tâche en retard",
        "trigger": "task.overdue", "delay_label": "J+1 après due", "delay_hours": 24,
        "action_type": "notify", "sla_min": 1,
        "description": "Notification Slack/Teams au manager du commercial sur tâche overdue.",
    },
    {
        "key": "A11", "name": "Compte à risque (CSM)",
        "trigger": "account.at_risk", "delay_label": "immédiat", "delay_hours": 0,
        "action_type": "composite", "sla_min": 1,
        "description": "Tâche CSM «Appeler le compte X» + alerte direction.",
    },
    {
        "key": "A12", "name": "Confirmation auto sur paiement reçu",
        "trigger": "payment.received", "delay_label": "<1 min", "delay_hours": 0,
        "action_type": "composite", "sla_min": 1,
        "description": "Bascule status → CONFIRMED + génère voucher voyageur.",
    },
]


def seed_rules(db: Session) -> int:
    """Idempotent seed: inserts missing rules, leaves existing untouched."""
    existing = set(db.execute(select(AutomationRule.key)).scalars().all())
    added = 0
    for spec in RULES:
        if spec["key"] in existing:
            continue
        db.add(AutomationRule(
            key=spec["key"], name=spec["name"], trigger=spec["trigger"],
            description=spec["description"], action_type=spec["action_type"],
            delay_label=spec["delay_label"], delay_hours=spec["delay_hours"],
            sla_min=spec["sla_min"], enabled=True, config={}, fire_count=0,
        ))
        added += 1
    if added:
        db.commit()
    return added


# ── Action executors (all return demo-friendly dicts) ───────────────────────


def _send_email_demo(to: str, subject: str, body: str) -> dict:
    return {
        "kind": "email", "to": to, "subject": subject,
        "preview": (body[:140] + "…") if len(body) > 140 else body,
        "message_id": f"demo-mail-{int(time.time() * 1000) % 1_000_000:06d}",
        "channel": "M365 (simulated)",
    }


def _create_task_demo(title: str, owner: str, priority: str = "normal", due_in_h: int = 24) -> dict:
    return {
        "kind": "task", "title": title, "owner": owner, "priority": priority,
        "due_at": (datetime.now(timezone.utc) + timedelta(hours=due_in_h)).isoformat(),
        "task_id": f"demo-task-{int(time.time() * 1000) % 1_000_000:06d}",
    }


def _notify_demo(channel: str, message: str) -> dict:
    return {"kind": "notify", "channel": channel, "message": message,
            "delivered_at": datetime.now(timezone.utc).isoformat()}


def _status_change_demo(entity: str, entity_id: str, new_status: str, reason: str = "") -> dict:
    return {"kind": "status_change", "entity": entity, "entity_id": entity_id,
            "new_status": new_status, "reason": reason}


def _generate_voucher_demo(project_id: str) -> dict:
    return {"kind": "voucher", "project_id": project_id,
            "voucher_no": f"VCH-DEMO-{int(time.time()) % 100000:05d}",
            "url": f"/api/automations/voucher/demo/{project_id}.pdf"}


# ── Per-rule executors ──────────────────────────────────────────────────────


def _exec(rule_key: str, payload: dict) -> dict:
    p = payload or {}
    client = p.get("client_email") or p.get("email") or "client@example.com"
    project = p.get("project_name") or p.get("title") or "Discovery Morocco"
    pid = p.get("project_id") or p.get("id") or "demo-prj"
    owner = p.get("owner_email") or "sales@stours.ma"

    if rule_key == "A1":
        return {
            "actions": [
                _send_email_demo(client, f"Bien reçu votre demande — {project}",
                                 "Notre équipe travaille sur votre devis personnalisé. Vous recevrez une proposition sous 24h."),
                _status_change_demo("project", pid, "LEAD", "auto-created from inquiry"),
                _create_task_demo(f"Assignation commerciale — {project}", owner, "high", 4),
            ],
            "summary": "Email + LEAD + assignation",
        }
    if rule_key == "A2":
        return {
            "actions": [_create_task_demo(f"Qualifier la demande — {project}", owner, "urgent", 4)],
            "summary": "Tâche qualif urgente créée (due +4h)",
        }
    if rule_key == "A3":
        return {
            "actions": [_send_email_demo(
                client, f"Suite à notre proposition — {project}",
                "Avez-vous eu le temps de consulter notre proposition ? Nous restons à votre disposition pour répondre à toute question."
            )],
            "summary": "Follow-up J+2 envoyé",
        }
    if rule_key == "A4":
        return {
            "actions": [
                _send_email_demo(client, f"On peut adapter — {project}",
                                 "Notre proposition peut évoluer selon vos contraintes. Dites-nous ce qu'il faudrait ajuster."),
                _create_task_demo(f"Appeler le client — {project}", owner, "high", 24),
            ],
            "summary": "Email J+5 + tâche d'appel",
        }
    if rule_key == "A5":
        return {
            "actions": [_status_change_demo("quotation", pid, "LOST", "no_response_after_10d")],
            "summary": "Devis basculé LOST automatiquement",
        }
    if rule_key == "A6":
        return {
            "actions": [
                _status_change_demo("project", pid, "BOOKED", "deal.won"),
                _create_task_demo("Réserver hôtels", "ops@stours.ma", "high", 24),
                _create_task_demo("Confirmer transport", "ops@stours.ma", "high", 24),
                _create_task_demo("Briefing guide", "ops@stours.ma", "normal", 48),
                _create_task_demo("Voucher fournisseur", "ops@stours.ma", "normal", 48),
                _create_task_demo("Welcome kit voyageur", "ops@stours.ma", "normal", 72),
                _send_email_demo(client, f"Confirmation — {project}",
                                 "Votre voyage est confirmé. Vous trouverez ci-joint votre dossier de voyage."),
                _generate_voucher_demo(pid),
            ],
            "summary": "Booking + 5 tâches ops + email + voucher",
        }
    if rule_key == "A7":
        sup = p.get("supplier_name") or "Royal Mansour Marrakech"
        amt = p.get("amount") or 12000
        return {
            "actions": [
                _create_task_demo(f"Payer {sup} ({amt}€)", "finance@stours.ma", "urgent", 0),
                _send_email_demo("finance@stours.ma", f"Échéance fournisseur J-3 — {sup}",
                                 f"Le règlement {amt}€ à {sup} arrive à échéance dans 3 jours."),
            ],
            "summary": f"Rappel paiement {sup} ({amt}€)",
        }
    if rule_key == "A8":
        return {
            "actions": [_send_email_demo(client, f"Votre voyage approche — {project}",
                                         "Rendez-vous dans 7 jours ! Documents et roadbook ci-joints.")],
            "summary": "Email pré-départ J-7 envoyé",
        }
    if rule_key == "A9":
        pax = p.get("pax_email") or client
        return {
            "actions": [
                _send_email_demo(client, f"Comment s'est passé votre voyage ?",
                                 "Votre avis nous est précieux. Notez votre expérience en 30 secondes."),
                _send_email_demo(pax, "Votre voyage avec STOURS", "Un mot rapide sur votre expérience ?"),
            ],
            "summary": "NPS contact + voyageur (J+3)",
        }
    if rule_key == "A10":
        task = p.get("task_title") or "Relancer client B2B"
        return {
            "actions": [_notify_demo("Teams · Direction commerciale",
                                     f"⚠️ Tâche en retard depuis 24h : « {task} » — owner : {owner}")],
            "summary": f"Alerte manager sur tâche overdue",
        }
    if rule_key == "A11":
        acc = p.get("account_name") or "Travel Agency Beta"
        return {
            "actions": [
                _create_task_demo(f"Appeler le compte {acc} (CSM)", "csm@stours.ma", "urgent", 4),
                _notify_demo("Direction", f"⚠️ Compte {acc} marqué AT_RISK — intervention CSM requise."),
            ],
            "summary": f"Tâche CSM + alerte direction sur {acc}",
        }
    if rule_key == "A12":
        return {
            "actions": [
                _status_change_demo("booking", pid, "CONFIRMED", "payment.received"),
                _generate_voucher_demo(pid),
            ],
            "summary": "Status CONFIRMED + voucher généré",
        }
    return {"actions": [], "summary": "no-op"}


# ── Public API ──────────────────────────────────────────────────────────────


def fire_event(db: Session, event: str, payload: Optional[dict] = None) -> list[dict]:
    """Match all enabled rules against a given event and execute them.

    Returns a list of run summaries (one per rule fired).
    """
    rules = db.execute(
        select(AutomationRule).where(
            AutomationRule.trigger == event, AutomationRule.enabled.is_(True)
        )
    ).scalars().all()
    runs: list[dict] = []
    for r in rules:
        runs.append(_run_single(db, r, payload or {}))
    return runs


def run_rule(db: Session, rule_key: str, payload: Optional[dict] = None) -> dict:
    """Manually trigger one rule by key (used by /run-rule endpoint)."""
    r = db.execute(select(AutomationRule).where(AutomationRule.key == rule_key)).scalar_one_or_none()
    if not r:
        raise ValueError(f"Rule {rule_key} not found")
    return _run_single(db, r, payload or {})


def _run_single(db: Session, r: AutomationRule, payload: dict) -> dict:
    started = time.perf_counter()
    out: dict = {}
    err: Optional[str] = None
    status = "success"
    try:
        out = _exec(r.key, payload)
    except Exception as exc:  # noqa: BLE001 — engine never crashes the request
        err = str(exc)
        status = "error"
        logger.warning("Automation %s failed: %s", r.key, exc)

    duration_ms = int((time.perf_counter() - started) * 1000)
    run = AutomationRun(
        rule_key=r.key, rule_name=r.name, trigger=r.trigger,
        status=status, duration_ms=duration_ms,
        payload=payload, output=out, error=err,
    )
    db.add(run)
    r.last_run_at = datetime.now(timezone.utc)
    r.last_status = status
    r.fire_count = (r.fire_count or 0) + 1
    db.commit()

    return {
        "rule_key": r.key, "rule_name": r.name, "status": status,
        "duration_ms": duration_ms, "summary": out.get("summary", ""),
        "actions": out.get("actions", []), "error": err,
    }


def cron_tick(db: Session) -> dict:
    """Daily cron simulation — fires the time-based rules (A3, A4, A5, A8, A9, A10).

    Demo mode generates representative payloads so the dashboard reflects activity.
    """
    fired: list[dict] = []
    sample_quotes = [
        {"id": "demo-q-001", "title": "Discovery Tangier-Chefchaouen", "client_email": "blue.pearl@example.com"},
        {"id": "demo-q-002", "title": "Luxury Sahara Experience", "client_email": "vip-travel@example.com"},
    ]
    for q in sample_quotes:
        fired += fire_event(db, "quote.sent", {"project_id": q["id"], "project_name": q["title"], "client_email": q["client_email"]})

    fired += fire_event(db, "project.start_date",
                        {"project_id": "demo-prj-up", "project_name": "Imperial Cities 14 Days", "client_email": "tour-op@example.com"})
    fired += fire_event(db, "project.completed",
                        {"project_id": "demo-prj-end", "project_name": "Atlas & Sahara 9D", "client_email": "ops@example.com",
                         "pax_email": "anna@example.com"})
    fired += fire_event(db, "task.overdue",
                        {"task_title": "Relancer agence Premier Tours", "owner_email": "amine@stours.ma"})

    return {
        "tick_at": datetime.now(timezone.utc).isoformat(),
        "rules_fired": len(fired),
        "runs": fired,
    }


def stats(db: Session) -> dict:
    rules = db.execute(select(AutomationRule)).scalars().all()
    total_rules = len(rules)
    enabled = sum(1 for r in rules if r.enabled)
    fires = sum((r.fire_count or 0) for r in rules)
    runs_24h = db.execute(
        select(func.count()).select_from(AutomationRun).where(
            AutomationRun.started_at >= datetime.now(timezone.utc) - timedelta(hours=24)
        )
    ).scalar_one()
    errors_24h = db.execute(
        select(func.count()).select_from(AutomationRun).where(
            AutomationRun.started_at >= datetime.now(timezone.utc) - timedelta(hours=24),
            AutomationRun.status == "error",
        )
    ).scalar_one()
    top = sorted(rules, key=lambda r: r.fire_count or 0, reverse=True)[:5]
    return {
        "total_rules": total_rules,
        "enabled": enabled,
        "disabled": total_rules - enabled,
        "fires_total": fires,
        "runs_24h": runs_24h or 0,
        "errors_24h": errors_24h or 0,
        "success_rate_pct": round(100.0 * (1.0 - (errors_24h / runs_24h)), 1) if runs_24h else 100.0,
        "top_rules": [
            {"key": r.key, "name": r.name, "fire_count": r.fire_count or 0,
             "last_status": r.last_status, "enabled": r.enabled}
            for r in top
        ],
    }
