# Electronic Records Policy

Electronic records in this repository include assay packets, candidate reports, decision gates, imported assay summaries, signatures, and audit trail entries.

Implemented controls:
- Controlled action endpoints create audit entries.
- Signed reports include signer, meaning, reason, payload hash, signature hash, and lock state.
- Wet-lab promotion requires two-person review.

Validated Part 11-style operation still requires unique user identities, password/MFA policy, e-signature certification, record retention SOPs, system validation evidence, authority checks, and periodic access review.
