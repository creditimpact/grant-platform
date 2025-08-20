from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GrantResult(BaseModel):
    name: str
    eligible: Optional[bool] = None
    score: int = 0
    estimated_amount: Optional[float] = None
    reasoning: Optional[List[str]] = None
    missing_fields: Optional[List[str]] = None
    next_steps: Optional[str] = None
    requiredForms: Optional[List[str]] = None
    tag_score: Optional[Dict[str, Any]] = None
    reasoning_steps: Optional[List[str]] = None
    llm_summary: Optional[str] = None
    debug: Optional[Dict[str, Any]] = None


class ResultsEnvelope(BaseModel):
    results: List[GrantResult] = Field(default_factory=list)
    requiredForms: List[str] = Field(default_factory=list)
