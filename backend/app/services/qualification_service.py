import re
from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class QualificationResult:
    """Explainable lead qualification output from prototype scoring rules."""

    lead_score: int
    lead_category: str
    urgency: str
    breakdown: List[str] = field(default_factory=list)
    model_disclaimer: str = (
        "Prototype rule-based qualification model for demonstration; "
        "not a scientifically validated predictive conversion model."
    )


def score_lead_profile(profile: Dict[str, Any]) -> QualificationResult:
    """
    Calculate an explainable 0-100 qualification score and HOT/WARM/COLD tier.

    Rubric (Prototype Rule-Based Model):
    - Contact & Identity (max 15 pts): Name (+5), Email (+5), Company (+5)
    - Product Fit & Requirements (max 25 pts): Product Interest (+10), Requirements (+15)
    - Budget Signal (max 25 pts): Quantified budget (+25), Exploratory budget (+12)
    - Timeline & Urgency (max 25 pts): Immediate/1-3 mo (+25), 3-6 mo (+15), 6+ mo (+5)
    - Company Size Fit (max 10 pts): Enterprise/50+ (+10), Mid-market/10-49 (+7), Small (+4)
    """
    score = 0
    breakdown: List[str] = []

    if profile.get("name"):
        score += 5
        breakdown.append("Contact name captured (+5)")
    if profile.get("email"):
        score += 5
        breakdown.append("Business email captured (+5)")
    if profile.get("company"):
        score += 5
        breakdown.append("Company identified (+5)")

    if profile.get("product_interest"):
        score += 10
        breakdown.append("Product interest identified (+10)")

    requirements = str(profile.get("requirements") or "").strip()
    if len(requirements) >= 12:
        score += 15
        breakdown.append("Actionable requirements captured (+15)")
    elif requirements:
        score += 8
        breakdown.append("Partial requirements captured (+8)")

    budget = str(profile.get("budget") or "").lower().strip()
    if budget:
        if re.search(r"(\$|usd|\d+\s*k|\d{3,}|enterprise|approved)", budget):
            score += 25
            breakdown.append("Quantified or approved budget signal (+25)")
        else:
            score += 12
            breakdown.append("Exploratory budget mentioned (+12)")

    timeline = str(profile.get("timeline") or "").lower().strip()
    urgency = "Exploratory"
    if timeline:
        if any(
            kw in timeline
            for kw in (
                "immediate",
                "asap",
                "this week",
                "this month",
                "this quarter",
                "q1",
                "q2",
                "q3",
                "q4",
                "1 month",
                "2 weeks",
                "30 days",
                "next month",
            )
        ):
            score += 25
            urgency = "Immediate"
            breakdown.append("Near-term purchase timeline (+25)")
        elif any(kw in timeline for kw in ("3 month", "6 month", "half", "soon")):
            score += 15
            urgency = "Near-Term"
            breakdown.append("Mid-term purchase timeline (+15)")
        else:
            score += 5
            breakdown.append("Long-term timeline stated (+5)")

    size_text = str(profile.get("company_size") or "").lower().strip()
    if size_text:
        nums = [int(n) for n in re.findall(r"\d+", size_text)]
        max_num = max(nums) if nums else 0
        if max_num >= 50 or "enterprise" in size_text:
            score += 10
            breakdown.append("Enterprise/mid-large team size (+10)")
        elif max_num >= 10 or "mid" in size_text:
            score += 7
            breakdown.append("Growing team size (+7)")
        else:
            score += 4
            breakdown.append("Small team size (+4)")

    score = min(100, score)
    if score >= 70:
        category = "HOT"
    elif score >= 40:
        category = "WARM"
    else:
        category = "COLD"

    return QualificationResult(
        lead_score=score,
        lead_category=category,
        urgency=urgency,
        breakdown=breakdown,
    )
