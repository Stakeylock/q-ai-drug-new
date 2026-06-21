from q_ai_drug.product.module_registry import estimate_credits, get_module, list_modules, tier_allows


def test_module_registry_has_all_scientist_modules():
    modules = list_modules()
    assert len(modules) == 18
    required = {
        "module_id",
        "name",
        "input_schema",
        "output_schema",
        "queue",
        "artifact_types",
        "tier_minimum",
        "credit_estimator",
        "claim_boundary",
        "quality_gate",
        "failure_policy",
    }
    assert all(required.issubset(module) for module in modules)
    assert get_module("wet_lab_triage_board").queue == "decision"


def test_tier_policy_and_credit_estimate():
    assert not tier_allows("student_free", "q_dock_studio")
    assert tier_allows("academic_researcher", "q_dock_studio")
    credits = estimate_credits("q_dock_studio", {"docking_pairs": 100, "gnina_pairs": 10})
    assert credits == 60
    assert estimate_credits("q_generate", {"n_generate": 1000}) == 11

