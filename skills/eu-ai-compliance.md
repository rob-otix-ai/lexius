---
name: eu-ai-compliance
description: Generate a compliance obligations checklist for an AI system under the EU AI Act
user-invocable: true
---

# EU AI Act Compliance Checklist

Generate a compliance obligations checklist based on the user's role and their AI system's risk level.

## Instructions

1. Ask the user:
   - Are you a **provider** (developing/placing on market) or **deployer** (using under your authority)?
   - What risk level is your system? (If unknown, suggest running `/eu-ai-classify` first)

2. Call `legalai_get_obligations` with the role and risk level.

3. Present obligations as a structured checklist:
   - Group by category (risk management, data governance, transparency, etc.)
   - Include article references for each obligation
   - Show deadlines where applicable
   - Mark which deadlines have already passed vs upcoming

4. If the system is high-risk, also retrieve the Annex IV technical documentation checklist:
   - Call `legalai_get_article` for articles numbered annex-iv-1 through annex-iv-9
   - Present as a documentation requirements checklist

5. Offer to deep-dive into any specific obligation by retrieving the full article text.

6. Remind the user of the applicable penalty tier for non-compliance.
