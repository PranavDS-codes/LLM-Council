from pydantic import BaseModel, Field
from typing import List, Dict, Optional

class CriticOutput(BaseModel):
    winner_id: str = Field(description="The ID of the winning response")
    rankings: List[str] = Field(description="List of IDs ordered from best to worst")
    reasoning: str = Field(description="Why the first place winner was chosen")
    flaws: Dict[str, str] = Field(description="A dictionary mapping Agent IDs to their specific flaws")
    scores: Dict[str, int] = Field(description="A dictionary mapping Agent IDs to their numeric scores (1-10)")

class ArchitectBlueprint(BaseModel):
    structure: List[str] = Field(description="Ordered list of section headers with instructions")
    tone_guidelines: str = Field(description="Voice and style instructions")
    missing_facts_to_add: List[str] = Field(description="Specific facts or corrections to inject")
    critique_integration: str = Field(description="Strategy for merging critique feedback")

