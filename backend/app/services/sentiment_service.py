from dataclasses import dataclass, field
from typing import List


POSITIVE_PHRASES = (
    "great",
    "awesome",
    "perfect",
    "interested",
    "love",
    "impressive",
    "helpful",
    "sounds good",
    "schedule",
    "book",
    "demo",
    "ready",
    "excited",
    "yes please",
)

NEGATIVE_PHRASES = (
    "expensive",
    "too costly",
    "overpriced",
    "not interested",
    "waste",
    "frustrated",
    "slow",
    "concern",
    "worried",
    "problem",
    "bad",
    "cancel",
    "no budget",
    "complicated",
)

OBJECTION_RULES = {
    "Pricing / Budget": ("expensive", "too much", "costly", "overpriced", "budget", "cheaper", "discount"),
    "Security / Compliance": ("security", "soc 2", "soc2", "gdpr", "privacy", "encryption", "compliance"),
    "Implementation Effort": ("onboarding", "setup time", "complicated", "migrate", "integration effort", "it team"),
    "Timing / Bandwidth": ("not ready", "next year", "too busy", "later", "no bandwidth"),
}

HIGH_INTENT_PHRASES = (
    "demo",
    "schedule",
    "book",
    "pricing",
    "quote",
    "pilot",
    "trial",
    "buy",
    "contract",
    "this month",
    "this quarter",
)

URGENCY_IMMEDIATE = ("asap", "urgent", "immediately", "today", "this week", "right away", "this month")
URGENCY_NEAR_TERM = ("soon", "this quarter", "next month", "evaluating")


@dataclass
class TextSentimentResult:
    """Text-only sentiment, objection, purchase interest, and urgency assessment."""

    sentiment: str
    purchase_interest: str
    urgency: str
    objections: List[str] = field(default_factory=list)
    analysis_method: str = "text_only_lexicon"


def analyze_customer_text(text: str) -> TextSentimentResult:
    """
    Analyze sentiment, objections, purchase interest, and urgency strictly from text.
    Does not perform acoustic or vocal emotion recognition.
    """
    lowered = (text or "").lower()

    pos_hits = sum(1 for phrase in POSITIVE_PHRASES if phrase in lowered)
    neg_hits = sum(1 for phrase in NEGATIVE_PHRASES if phrase in lowered)

    # Simple negation flip for common positive words
    for word in ("interested", "good", "ready"):
        if f"not {word}" in lowered:
            pos_hits = max(0, pos_hits - 1)
            neg_hits += 1

    if pos_hits > neg_hits:
        sentiment = "Positive"
    elif neg_hits > pos_hits:
        sentiment = "Negative"
    else:
        sentiment = "Neutral"

    objections: List[str] = []
    for label, keywords in OBJECTION_RULES.items():
        if any(kw in lowered for kw in keywords):
            objections.append(label)

    intent_hits = sum(1 for kw in HIGH_INTENT_PHRASES if kw in lowered)
    if intent_hits >= 2:
        purchase_interest = "High"
    elif intent_hits == 1 or pos_hits > 0:
        purchase_interest = "Medium"
    else:
        purchase_interest = "Low"

    if any(kw in lowered for kw in URGENCY_IMMEDIATE):
        urgency = "Immediate"
    elif any(kw in lowered for kw in URGENCY_NEAR_TERM):
        urgency = "Near-Term"
    else:
        urgency = "Exploratory"

    return TextSentimentResult(
        sentiment=sentiment,
        purchase_interest=purchase_interest,
        urgency=urgency,
        objections=objections,
    )
