"""Module execution runner registry."""

from __future__ import annotations

from importlib import import_module
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from q_ai_drug.product.module_runners.base import BaseModuleRunner

_RUNNER_REGISTRY: dict[str, type[BaseModuleRunner]] | None = None

_RUNNER_SPECS = {
    "onco_data_builder": ("q_ai_drug.product.module_runners.onco_data_builder", "OncoDataBuilderRunner"),
    "q_filter": ("q_ai_drug.product.module_runners.q_filter", "QFilterRunner"),
    "q_orbital_analyzer": ("q_ai_drug.product.module_runners.q_orbital_analyzer", "QOrbitalAnalyzerRunner"),
    "q_dock_studio": ("q_ai_drug.product.module_runners.q_dock_studio", "QDockStudioRunner"),
    "activity_model_studio": ("q_ai_drug.product.module_runners.downstream", "ActivityModelStudioRunner"),
    "applicability_domain_guard": ("q_ai_drug.product.module_runners.downstream", "ApplicabilityDomainGuardRunner"),
    "q_rank": ("q_ai_drug.product.module_runners.q_rank_scientific", "QRankRunner"),
    "wet_lab_triage_board": ("q_ai_drug.product.module_runners.downstream", "WetLabTriageBoardRunner"),
    "q_report": ("q_ai_drug.product.module_runners.downstream", "QReportRunner"),
}


def _load_runners() -> dict[str, type[BaseModuleRunner]]:
    """Load implemented module runners lazily."""
    global _RUNNER_REGISTRY
    if _RUNNER_REGISTRY is not None:
        return _RUNNER_REGISTRY
    registry: dict[str, type[BaseModuleRunner]] = {}
    for module_id, (module_path, class_name) in _RUNNER_SPECS.items():
        module = import_module(module_path)
        registry[module_id] = getattr(module, class_name)
    _RUNNER_REGISTRY = registry
    return _RUNNER_REGISTRY


def get_runner(module_id: str) -> type[BaseModuleRunner] | None:
    """Get the runner class for a module."""
    return _load_runners().get(module_id)
