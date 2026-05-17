"""Tests for docking scientific helper utilities."""

from pathlib import Path

import pytest


def test_compute_pose_rmsd_identical_ethanol(tmp_path: Path):
    Chem = pytest.importorskip("rdkit.Chem")
    AllChem = pytest.importorskip("rdkit.Chem.AllChem")
    from q_ai_drug.docking.redocking import compute_pose_rmsd

    mol = Chem.AddHs(Chem.MolFromSmiles("CCO"))
    assert AllChem.EmbedMolecule(mol, randomSeed=7) == 0
    sdf1 = tmp_path / "ref.sdf"
    sdf2 = tmp_path / "dock.sdf"
    w = Chem.SDWriter(str(sdf1)); w.write(mol); w.close()
    w = Chem.SDWriter(str(sdf2)); w.write(mol); w.close()

    result = compute_pose_rmsd(sdf1, sdf2)
    assert result.status == "redocking_pass"
    assert result.validation_pass is True
    assert result.rmsd_angstrom is not None
    assert result.rmsd_angstrom <= 0.1


def test_geometric_interaction_fingerprint_detects_contact(tmp_path: Path):
    Chem = pytest.importorskip("rdkit.Chem")
    from q_ai_drug.docking.interactions import compute_interaction_fingerprint

    receptor = tmp_path / "rec.pdb"
    receptor.write_text(
        "ATOM      1  O   ASP A   1       0.000   0.000   0.000  1.00 20.00           O\n"
        "ATOM      2  C   VAL A   2       8.000   8.000   8.000  1.00 20.00           C\n"
        "END\n",
        encoding="utf-8",
    )
    mol = Chem.RWMol()
    atom_idx = mol.AddAtom(Chem.Atom("O"))
    conf = Chem.Conformer(1)
    conf.SetAtomPosition(atom_idx, (1.5, 0.0, 0.0))
    rmol = mol.GetMol()
    rmol.AddConformer(conf)
    ligand = tmp_path / "lig.sdf"
    w = Chem.SDWriter(str(ligand)); w.write(rmol); w.close()

    result = compute_interaction_fingerprint(receptor, ligand, "cand_1")
    assert result.interaction_quality == "geometric_proxy"
    assert result.contact_count >= 1
    assert "ASP:A:1" in result.contact_residues
    assert result.hbond_like_contacts is not None
    assert result.hbond_like_contacts >= 1
