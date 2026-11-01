# ATS operations extension

Implemented API endpoints:
- PATCH /api/email-templates/:id (manager only, snapshot template versions)
- GET/POST /api/interviews; PATCH /api/interviews/:id
- GET/POST /api/evaluations (reviewers can submit their own ratings)
- PATCH /api/applications/:id/memo
- GET /api/applications/:id/history
- GET /api/ai/models (HASA server-side model catalog)

Apply migration 0003 before deploying the updated Worker. All APIs require existing ATS authentication. The user interface and external live API contracts still require validation. No real applicant emails should be sent for smoke tests.
