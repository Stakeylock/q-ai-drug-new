# API And Developer Experience

The service exposes versioned scientist workflow endpoints alongside the existing local research endpoints.

## Module Discovery

```bash
curl http://127.0.0.1:8000/v1/tools
curl http://127.0.0.1:8000/v1/tools/q_dock_studio
```

Authenticated project-specific module discovery:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/projects/$PROJECT_ID/tools
```

## Credit Estimate

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"academic_researcher","payload":{"docking_pairs":300,"gnina_pairs":30}}' \
  http://127.0.0.1:8000/projects/$PROJECT_ID/tools/q_dock_studio/estimate
```

Estimate responses include `quota_status`, `quota_detail`, `credit_balance`, and active tier quotas. A module can be schema-valid but quota-blocked if the requested tier exceeds the organization's plan.

## Run A Module

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"student_pro","payload":{"budget":30}}' \
  http://127.0.0.1:8000/projects/$PROJECT_ID/tools/wet_lab_triage_board/run
```

When `QAI_USE_QUEUE=1`, module runs are enqueued and not executed inside the API process. In local developer mode, lightweight modules run in a background thread.

Every accepted run reserves credits before enqueueing and writes a standardized result to:

```text
outputs/<project_name>/module_runs/<module_id>/<run_id>/module_result.json
```

The result JSON contains artifacts, warnings, limitations, next actions, credits used, execution mode, and the computational-hypothesis claim boundary.

## Billing And Usage

```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/v1/billing/summary

curl -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8000/projects/$PROJECT_ID/usage

curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"academic_researcher"}' \
  http://127.0.0.1:8000/v1/billing/plan
```

Plan changes are owner/admin-only. The billing summary returns the current plan, credit balance, monthly limit, recent credit-ledger rows, and recent usage events.

## Dry Run

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier":"student_free","dry_run":true,"payload":{"molecule_count":50}}' \
  http://127.0.0.1:8000/projects/$PROJECT_ID/tools/q_filter/run
```

Dry runs validate access, tier/quota policy, queue wiring, and module result contracts without running scientific compute.

## Python SDK Shape

```python
from qai import Client

client = Client(api_key="...")
project = client.projects.create(name="EGFR library triage")
client.molecules.upload(project.id, "library.smi")
estimate = client.tools.estimate(project.id, "q_dock_studio", docking_pairs=300)
run = client.tools.run(project.id, "wet_lab_triage_board", budget=30)
run.wait()
client.reports.download(project.id, "wet_lab_assay_pack.md")
```

This SDK shape is documented for client development; the repository currently implements the HTTP service contracts.
