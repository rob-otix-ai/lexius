---
name: compliance
description: Generate a compliance obligations checklist for a system under any supported legislation
---

# Compliance Obligations Checklist

Generate a compliance obligations checklist based on the user's role and their system's risk level under a chosen legislation.

## Instructions

1. Determine the target legislation:
   - If `$ARGUMENTS` contains a legislation hint (e.g. "eu-ai-act", "cima-aml", "dora"), use that.
   - Otherwise, call `legalai_list_legislations` to retrieve the list of available legislations and ask the user which one applies.

2. Ask the user:
   - What is their role under this legislation? (e.g. provider, deployer, operator, reporting entity — role names vary by legislation; accept natural language and map to whatever the tool supports)
   - What risk or classification level is their system? (If unknown, suggest running `/lexius:classify` first)

3. Call `legalai_get_obligations` with the chosen `legislationId`, role, and risk level.

4. Present obligations as a structured checklist:
   - Group by category (e.g. risk management, data governance, transparency, reporting, record-keeping)
   - Include article references for each obligation
   - Show deadlines where applicable, and mark which have passed vs are upcoming

5. **If the legislation is `eu-ai-act`** and the system is high-risk, also retrieve the Annex IV technical documentation checklist:
   - Call `legalai_get_article` for articles numbered annex-iv-1 through annex-iv-9
   - Present as a documentation requirements checklist

   For other legislations, check whether the tool returns supplementary annexes or schedules and surface those similarly.

6. Offer to deep-dive into any specific obligation by retrieving the full article text via `legalai_get_article`.

7. Remind the user of the applicable penalty tier for non-compliance and offer to run `/lexius:penalty` for a precise exposure calculation.
