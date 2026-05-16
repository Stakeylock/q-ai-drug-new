from q_ai_drug.docking.vina_runner import parse_vina_log


def test_parse_vina_log() -> None:
    text = """
-----+------------+----------+----------
   1        -8.4      0.000      0.000
   2        -7.9      1.203      2.104
"""
    rows = parse_vina_log(text)
    assert rows[0]["affinity_kcal_mol"] == -8.4
    assert rows[1]["mode"] == 2
