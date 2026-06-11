"""Abstract base class for module runners.

All module execution runners inherit from BaseModuleRunner and implement:
- validate_payload(): Type-check and validate the input payload
- resolve_inputs(): Load or reference input artifacts
- run(): Execute the actual computation
- write_outputs(): Save results to disk
- register_artifacts(): Register outputs in artifact store
"""

from __future__ import annotations

import json
import shutil
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

import pandas as pd

from q_ai_drug.product.module_registry import estimate_credits, get_module
from q_ai_drug.service.tool_payloads import validate_payload


class JobStatus(str, Enum):
    """Granular job status codes."""
    QUEUED = "queued"
    RUNNING = "running"
    VALIDATING_INPUTS = "validating_inputs"
    PREPARING_MOLECULES = "preparing_molecules"
    RUNNING_DOCKING = "running_docking"
    RUNNING_QM = "running_qm"
    WRITING_OUTPUTS = "writing_outputs"
    SUCCEEDED = "succeeded"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class FailureCode(str, Enum):
    """Granular failure codes for actionable error messages."""
    MISSING_INPUT = "missing_input"
    INVALID_INPUT = "invalid_input"
    MISSING_DEPENDENCY = "missing_dependency"
    TOOL_UNAVAILABLE = "tool_unavailable"
    QUOTA_EXCEEDED = "quota_exceeded"
    TIER_BLOCKED = "tier_blocked"
    FAILED_COMPUTE = "failed_compute"
    FAILED_VALIDATION = "failed_validation"
    ARTIFACT_SYSTEM_NOT_READY = "artifact_system_not_ready"
    MOCK_MODE_ONLY = "mock_mode_only"
    UNEXPECTED_ERROR = "unexpected_error"


class ModuleRunnerError(Exception):
    """Base exception for module runner errors."""
    pass


class ModuleInputError(ModuleRunnerError):
    """Raised when the input payload is invalid or input files are missing."""
    pass


class ModuleExecutionError(ModuleRunnerError):
    """Raised when scientific compute fails."""
    pass


class MissingDependencyError(ModuleExecutionError):
    """Raised when a required scientific tool or python package is not installed."""
    pass



class BaseModuleRunner(ABC):
    """Abstract base class for module execution runners.
    
    Each concrete runner (Q-Filter, Q-Dock, etc.) implements the full lifecycle:
    1. Validate payload (typed validation, not just JSON schema)
    2. Resolve inputs (load from artifacts or uploads)
    3. Run computation (actual science or dry-run)
    4. Write outputs (save to disk with proper structure)
    5. Register artifacts (track in artifact store)
    6. Record usage (actual vs requested for billing)
    """
    
    def __init__(
        self,
        module_id: str,
        project_dir: Path,
        run_id: str,
        payload: dict[str, Any],
    ):
        """Initialize module runner.
        
        Args:
            module_id: Module identifier (e.g., "q_filter")
            project_dir: Project root directory
            run_id: Unique run identifier
            payload: Input payload dictionary (already JSON-parsed)
        """
        self.module_id = module_id
        self.project_dir = project_dir
        self.run_id = run_id
        self.payload = payload
        self.module = get_module(module_id)
        
        # Output directory for this run
        self.output_dir = project_dir / "module_runs" / module_id / run_id
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Validated payload (subclass responsibility)
        self.validated_payload: dict[str, Any] | None = None
        
        # Artifacts created by this run
        self.artifacts: list[dict[str, Any]] = []
        
        # Usage metrics (actual vs requested)
        self.usage_actual: dict[str, Any] = {}
        self.usage_requested: dict[str, Any] = {}
        
        # Warnings and failures
        self.warnings: list[str] = []
        self.claim_boundary = self.module.claim_boundary
    
    # ========================================================================
    # Abstract methods (each runner implements these)
    # ========================================================================
    
    @abstractmethod
    def validate_payload(self) -> None:
        """Validate and parse the input payload.
        
        Must:
        - Check all required fields are present
        - Type-check values
        - Cross-validate constraints (e.g., box size if pocket_box given)
        - Set self.validated_payload on success
        - Raise ModuleInputError with actionable message on failure
        
        Must NOT:
        - Access external files
        - Start computation
        - Modify project state
        
        Raises:
            ModuleInputError: If payload is invalid
        """
        pass
    
    @abstractmethod
    def resolve_inputs(self) -> None:
        """Resolve input artifacts and files.
        
        Must:
        - Load or verify existence of input data
        - Handle both artifact_id and upload_file paths
        - Validate file format/content
        - Set self.usage_requested based on actual input counts
        - Cache input data as needed
        
        Raises:
            ModuleInputError: If required inputs are missing or invalid
        """
        pass
    
    @abstractmethod
    def run(self) -> None:
        """Execute the actual computation.
        
        If self.payload.get('dry_run'):
        - Estimate computation without running it
        - Set self.usage_actual with estimates
        - Do not create full results
        
        Else:
        - Run full computation
        - Set self.usage_actual with actual values
        - Cache intermediate results as needed
        - Record any warnings or partial failures
        
        Must NOT:
        - Write files directly; use write_outputs()
        - Modify self.artifacts; use register_artifact()
        
        Raises:
            ModuleExecutionError: If computation fails
        """
        pass
    
    @abstractmethod
    def write_outputs(self) -> None:
        """Write computation results to output_dir.
        
        Must:
        - Create output files in self.output_dir
        - Use a consistent subdirectory structure
        - Validate output format
        - Call register_artifact() for each output
        - Handle dry-run mode (may skip large outputs)
        
        Must NOT:
        - Write to project root or other modules' directories
        - Leave temporary files
        - Overwrite existing artifacts
        
        Raises:
            ModuleExecutionError: If writing fails
        """
        pass
    
    # ========================================================================
    # Concrete methods (utilities for all runners)
    # ========================================================================
    
    def register_artifact(
        self,
        path: Path,
        artifact_type: str,
        name: str | None = None,
    ) -> dict[str, Any]:
        """Register an output artifact.
        
        Args:
            path: Absolute path to artifact file
            artifact_type: Type (csv, json, html, sdf, pdb, etc.)
            name: Human-readable name; defaults to file stem
            
        Returns:
            Artifact record dictionary
        """
        if not path.exists():
            raise ModuleExecutionError(f"Artifact not found: {path}")
        
        # Generate initial artifact metadata
        artifact = {
            "type": artifact_type,
            "name": name or path.stem,
            "uri": path.as_posix(),
            "relative_path": path.relative_to(self.project_dir).as_posix(),
            "size_bytes": path.stat().st_size,
            "checksum": self._checksum(path),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        # Wire into persistent registry if available
        try:
            from q_ai_drug.service.artifact_resolver import register_artifact as register_project_artifact
            record = register_project_artifact(
                project_id=str(self.project_dir),
                module_id=self.module_id,
                run_id=self.run_id,
                file_path=path,
                artifact_type=artifact_type,
            )
            artifact["artifact_id"] = record.artifact_id
        except Exception as e:
            # Fallback if registry is missing or fails (e.g. tests)
            pass

        self.artifacts.append(artifact)
        return artifact
    
    def write_csv(self, rows: list[dict[str, Any]], name: str) -> Path:
        """Write rows to CSV file.
        
        Args:
            rows: List of dictionaries
            name: Output file name (without .csv)
            
        Returns:
            Path to written file
        """
        path = self.output_dir / f"{name}.csv"
        path.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(rows).to_csv(path, index=False)
        return path
    
    def write_json(self, data: dict[str, Any] | list[dict[str, Any]], name: str) -> Path:
        """Write data to JSON file.
        
        Args:
            data: Dictionary or list to serialize
            name: Output file name (without .json)
            
        Returns:
            Path to written file
        """
        path = self.output_dir / f"{name}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
        return path
    
    def read_csv(self, path: Path) -> pd.DataFrame:
        """Read CSV file safely.
        
        Args:
            path: Path to CSV file
            
        Returns:
            DataFrame (empty if file doesn't exist or is empty)
        """
        if not path.exists() or path.stat().st_size == 0:
            return pd.DataFrame()
        return pd.read_csv(path)
    
    def read_json(self, path: Path) -> dict[str, Any] | list[dict[str, Any]]:
        """Read JSON file safely.
        
        Args:
            path: Path to JSON file
            
        Returns:
            Parsed JSON object/array, or empty dict if file doesn't exist
        """
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))
    
    def copy_if_exists(self, source: Path, name: str) -> Path | None:
        """Copy file from source to output_dir.
        
        Args:
            source: Source file path
            name: Destination file name (in output_dir)
            
        Returns:
            Path to copied file, or None if source doesn't exist
        """
        if not source.exists():
            return None
        dest = self.output_dir / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
        return dest
    
    def add_warning(self, message: str) -> None:
        """Record a warning message.
        
        Args:
            message: Warning text
        """
        self.warnings.append(message)
    
    def add_usage_requested(self, key: str, value: int) -> None:
        """Record a requested usage metric.
        
        Args:
            key: Metric name (e.g., "molecule_count")
            value: Requested count or value
        """
        self.usage_requested[key] = value
    
    def add_usage_actual(self, key: str, value: int) -> None:
        """Record an actual usage metric.
        
        Args:
            key: Metric name
            value: Actual count/value
        """
        self.usage_actual[key] = value
    
    def get_result(self, status: str = "succeeded") -> dict[str, Any]:
        """Build standardized module result dictionary.

        Matches the legacy _standard_result() schema for full compatibility.

        Args:
            status: Result status (succeeded, partial_success, failed, etc.)

        Returns:
            Standardized module_result.json payload
        """
        is_dry_run = bool(self.payload.get("dry_run") or self.payload.get("_dry_run"))
        execution_mode = "dry_run" if is_dry_run else "small_or_production"
        
        if status == "failed":
            credits_used = 0.0
        else:
            credits_used = 0.1 if is_dry_run else estimate_credits(self.module_id, self.payload)
        return {
            "module_id": self.module_id,
            "module_name": self.module.name,
            "project_id": self.project_dir.name,
            "run_id": self.run_id,
            "status": status,
            "execution_mode": execution_mode,
            "queue": self.module.queue,
            "artifacts": self.artifacts,
            "warnings": self.warnings,
            "limitations": [self.claim_boundary],
            "next_actions": [],
            "credits_used": credits_used,
            "claim_boundary": "Computational research hypothesis only. Wet-lab validation is required.",
            "usage": {
                "requested": self.usage_requested,
                "actual": self.usage_actual,
            },
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    
    # ========================================================================
    # Main execution entry point
    # ========================================================================
    
    def execute(self) -> dict[str, Any]:
        """Execute the full module pipeline.
        
        Returns:
            Standardized module_result.json payload
        """
        try:
            self.validate_payload()
            self.resolve_inputs()
            self.run()
            self.write_outputs()
            
            result = self.get_result("succeeded")
            
            # Write module_result.json
            self.write_json(result, "module_result")
            self.register_artifact(
                self.output_dir / "module_result.json",
                "json",
                "module_result"
            )
            
            return result
            
        except ModuleInputError as e:
            result = {
                **self.get_result("failed"),
                "failure_code": FailureCode.INVALID_INPUT.value,
                "failure_message": str(e),
                "actionable_message": self._actionable_message_for_error(str(e)),
            }
            self.write_json(result, "module_result")
            return result

        except MissingDependencyError as e:
            result = {
                **self.get_result("failed"),
                "failure_code": FailureCode.MISSING_DEPENDENCY.value,
                "failure_message": str(e),
                "actionable_message": self._actionable_message_for_error(str(e)),
            }
            self.write_json(result, "module_result")
            return result

        except ModuleExecutionError as e:
            err_str = str(e)
            code = FailureCode.TOOL_UNAVAILABLE.value if "not available" in err_str.lower() else FailureCode.FAILED_COMPUTE.value
            result = {
                **self.get_result("failed"),
                "failure_code": code,
                "failure_message": err_str,
            }
            self.write_json(result, "module_result")
            return result

        except Exception as e:
            result = {
                **self.get_result("failed"),
                "failure_code": FailureCode.UNEXPECTED_ERROR.value,
                "failure_message": str(e),
            }
            self.write_json(result, "module_result")
            raise
    
    # ========================================================================
    # Private utilities
    # ========================================================================
    
    @staticmethod
    def _checksum(path: Path) -> str:
        """Compute SHA256 checksum of file."""
        import hashlib
        sha = hashlib.sha256()
        with open(path, "rb") as f:
            sha.update(f.read())
        return sha.hexdigest()[:16]
    
    def _actionable_message_for_error(self, error: str) -> str:
        """Generate actionable user message for error.
        
        Args:
            error: Error message from exception
            
        Returns:
            User-friendly message with suggested next action
        """
        if "smiles" in error.lower():
            return "Make sure your file contains valid SMILES strings in the expected column."
        if "pocket" in error.lower():
            return "Define a docking pocket (box coordinates or reference ligand)."
        if "receptor" in error.lower():
            return "Upload a valid protein structure file (PDB or PDBQT)."
        return f"Error: {error}. Please check your inputs and try again."
