from __future__ import annotations
from typing import List
from schemas import ClarifyingQuestion


QUESTION_MAP = {
    "w2_employee_count": "How many W-2 employees do you have?",
    "ein": "What's your EIN? (NN-NNNNNNN)",
    "entity_type": "What's your entity type? (LLC, corp, s-corp, sole-prop, nonprofit)",
}


def build_clarifying_questions(missing_fields: List[str]) -> List[ClarifyingQuestion]:
    questions: List[ClarifyingQuestion] = []
    for field in missing_fields:
        question = QUESTION_MAP.get(field, f"Please provide your {field}")
        questions.append(ClarifyingQuestion(field=field, question=question))
    return questions
