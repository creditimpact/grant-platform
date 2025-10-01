from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field


class GrantResult(BaseModel):
    name: str
    eligible: Optional[bool] = None
    score: int = 0
    certainty_level: Optional[str] = None
    estimated_amount: Optional[float] = None
    reasoning: Optional[List[str]] = None
    missing_fields: Optional[List[str]] = None
    next_steps: Optional[str] = None
    required_forms: Optional[List[str]] = None
    required_documents: Optional[List[str]] = None
    tag_score: Dict[str, Any] = Field(default_factory=dict)
    reasoning_steps: Optional[List[str]] = None
    llm_summary: Optional[str] = None
    debug: Optional[Dict[str, Any]] = None
    status: Literal["eligible", "conditional", "ineligible"]
    rationale: str = Field(min_length=3, max_length=200)


class ResultsEnvelope(BaseModel):
    results: List[GrantResult] = Field(default_factory=list)
    required_forms: List[str] = Field(default_factory=list)
    required_documents: List[str] = Field(default_factory=list)
