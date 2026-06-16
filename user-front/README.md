# Quinfo Q-AI User Frontend

User-facing React app for tier-aware login, patient-informed research intake, diagnosis-filtered AlphaFold target selection, and computational candidate ranking.

## Run

```powershell
cd user-front
npm install
npm run dev
```

Open `http://127.0.0.1:5174`.

The app proxies API calls to the q_ai_drug backend on `http://127.0.0.1:8000`.

## Notes

- This is a research-use UI, not a clinical decision or treatment recommendation tool.
- Patient information should be de-identified before use.
- Login/signup uses `/auth/login` and `/auth/signup` when the backend is active.
- Tier plan setup uses `/v1/billing/plan`.
- The patient-specific pipeline uses real project/target endpoints when authenticated and falls back to a local guided demo when backend patient-specific APIs are not available yet.
