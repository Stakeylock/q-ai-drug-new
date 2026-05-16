from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

try:
    from qiskit import QuantumCircuit
    from qiskit.quantum_info import Statevector
except Exception:
    QuantumCircuit = None
    Statevector = None


QML_FEATURES = ["homo_lumo_gap_ev", "dipole_debye", "quantum_score", "affinity_kcal_mol"]


def _normalized_matrix(df: pd.DataFrame) -> np.ndarray:
    matrix = []
    for column in QML_FEATURES:
        values = pd.to_numeric(df.get(column, 0.0), errors="coerce").fillna(0.0).to_numpy(dtype=float)
        if column == "affinity_kcal_mol":
            values = -values
        span = values.max() - values.min()
        if not np.isfinite(span) or span == 0:
            normed = np.full_like(values, 0.5, dtype=float)
        else:
            normed = (values - values.min()) / span
        matrix.append(normed)
    return np.vstack(matrix).T


def _statevector(features: np.ndarray) -> np.ndarray:
    if QuantumCircuit is None or Statevector is None:
        raise RuntimeError("Qiskit is not installed.")
    n_qubits = min(4, len(features))
    circuit = QuantumCircuit(n_qubits)
    for idx in range(n_qubits):
        angle = float(features[idx]) * np.pi
        circuit.ry(angle, idx)
        circuit.rz(angle / 2.0, idx)
    for idx in range(n_qubits - 1):
        circuit.cx(idx, idx + 1)
    return np.asarray(Statevector.from_instruction(circuit).data)


def quantum_kernel_scores(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if out.empty:
        out["qml_score"] = []
        return out
    features = _normalized_matrix(out)
    if QuantumCircuit is None or Statevector is None:
        gap = pd.to_numeric(out.get("homo_lumo_gap_ev", 4.8), errors="coerce").fillna(4.8)
        q = pd.to_numeric(out.get("quantum_score", 0.5), errors="coerce").fillna(0.5)
        out["qml_score"] = np.clip(0.65 * q + 0.35 * (1 - (gap - 4.8).abs() / 4.8), 0, 1)
        out["qml_mode"] = "proxy_kernel_no_qiskit"
        out["qml_is_real"] = False
        return out

    scores = np.zeros(len(out), dtype=float)
    for target_id, idx_values in out.groupby("target_id").groups.items():
        positions = list(idx_values)
        statevectors = np.vstack([_statevector(features[pos]) for pos in positions])
        kernel = np.abs(statevectors @ np.conjugate(statevectors.T)) ** 2
        centrality = kernel.mean(axis=1)
        qscore = pd.to_numeric(out.iloc[positions].get("quantum_score", 0.5), errors="coerce").fillna(0.5).to_numpy()
        scores[positions] = np.clip(0.55 * qscore + 0.45 * centrality, 0, 1)
    out["qml_score"] = scores
    out["qml_mode"] = "qiskit_statevector_kernel"
    out["qml_is_real"] = True
    return out


def run_qml_rerank(docking_csv: str | Path, qm_csv: str | Path, out_dir: str | Path) -> pd.DataFrame:
    docking = pd.read_csv(docking_csv)
    qm = pd.read_csv(qm_csv)
    merged = docking.merge(qm, on=["target_id", "candidate_id"], how="inner", suffixes=("", "_qm"))
    result = quantum_kernel_scores(merged)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    result[["target_id", "candidate_id", "qml_score", "qml_mode", "qml_is_real"]].to_csv(
        out_dir / "quantum_kernel_scores.csv", index=False
    )
    return result


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run Qiskit statevector quantum-kernel reranking.")
    parser.add_argument("--docking", required=True)
    parser.add_argument("--qm", required=True)
    parser.add_argument("--out", default="outputs/cancer_proof_v1/qml")
    args = parser.parse_args(argv)
    result = run_qml_rerank(args.docking, args.qm, args.out)
    print(f"Wrote {len(result)} QML reranking rows to {Path(args.out) / 'quantum_kernel_scores.csv'}")


if __name__ == "__main__":
    main()
