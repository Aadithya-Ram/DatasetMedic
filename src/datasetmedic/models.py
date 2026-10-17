"""The API contract. OpenAPI is the source for generated frontend types."""
from typing import Literal

from pydantic import BaseModel, Field


class AuditConfig(BaseModel):
    roles: dict[str, Literal["dataset", "train", "validation", "test"]] = Field(default_factory=dict)
    target: str | None = None
    groups: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)


class Step(BaseModel):
    op: Literal["drop", "deduplicate", "trim", "cast", "fill"]
    columns: list[str] = Field(default_factory=list)
    dtype: Literal["text", "integer", "decimal", "boolean", "date"] | None = None
    method: Literal["median", "mode", "constant"] = "median"
    value: str | int | float | bool | None = None


class Recipe(BaseModel):
    steps: list[Step] = Field(default_factory=list, max_length=50)


class JobRequest(BaseModel):
    kind: Literal["audit", "preview", "export"]
    config: AuditConfig = Field(default_factory=AuditConfig)
    recipe: Recipe = Field(default_factory=Recipe)
    output_format: Literal["csv", "parquet"] = "parquet"

