from __future__ import annotations
from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class BusinessProfile(BaseModel):
    """Basic business information supplied by the user.

    All fields are optional and unknown keys are ignored. Dates are kept as
    strings and normalised later in the request pipeline.
    """

    model_config = ConfigDict(extra="ignore")

    ein: Optional[str] = Field(None, description="NN-NNNNNNN")
    w2_employee_count: Optional[int] = Field(None, ge=0)
    annual_revenue: Optional[int] = Field(None, ge=0)
    entity_type: Optional[Literal["llc", "corp", "s-corp", "sole-prop", "nonprofit"]] = None
    year_founded: Optional[int] = Field(None, ge=1800, le=2100)
    incorporation_date: Optional[str] = None


class AnalyzerFields(BaseModel):
    model_config = ConfigDict(extra="ignore")

    fields: Dict[str, Any] = Field(default_factory=dict)


class AgentCheckRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    notes: Optional[str] = None
    profile: Optional[BusinessProfile] = None
    analyzer_fields: Optional[Dict[str, Any]] = None
    explain: bool = True
    session_id: Optional[str] = None


class ClarifyingQuestion(BaseModel):
    field: str
    question: str


class Reasoning(BaseModel):
    reasoning_steps: List[str] = Field(default_factory=list)
    clarifying_questions: List[ClarifyingQuestion] = Field(default_factory=list)


class AgentCheckResponse(BaseModel):
    normalized_profile: Dict[str, Any]
    eligibility: Any
    reasoning: Reasoning


class FormFillRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    form_name: Literal[
        "form_8974",
        "form_6765",
        "form_424A",
        "form_sf424",
        "form_RD_400_1",
        "form_RD_400_4",
        "form_RD_400_8",
    ]
    user_payload: Dict[str, Any]
    session_id: Optional[str] = None


class FormFillResponse(BaseModel):
    filled_form: Dict[str, Any]
    reasoning: Reasoning
