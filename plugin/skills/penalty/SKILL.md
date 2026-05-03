---
name: penalty
description: Calculate maximum penalty exposure for a violation under any supported legislation
---

# Penalty Assessment

Calculate the maximum penalty exposure for a given violation type and organisation profile under a chosen legislation.

## Instructions

1. Determine the target legislation:
   - If `$ARGUMENTS` contains a legislation hint (e.g. "eu-ai-act", "cima-aml", "dora"), use that.
   - Otherwise, call `legalai_list_legislations` to retrieve the list of available legislations and ask the user which one applies.

2. Ask the user:
   - What type of violation? (The violation categories differ by legislation — describe what requirement they may not be meeting and help them map it to a category if needed)
   - What is their organisation's annual global turnover or revenue in the relevant currency?
   - Are they an SME, startup, or large organisation?

3. Call `legalai_calculate_penalty` with the provided information and the chosen `legislationId`.

4. Present the result:
   - Maximum fine amount (in the currency specified by the legislation)
   - How it was calculated (fixed amount vs percentage of turnover, whichever is higher)
   - Whether any SME or startup reduction was applied, with the relevant article reference
   - The penalty tier and the article that establishes it

   **If the legislation is `eu-ai-act`**, note Art. 99(6) for the SME reduction specifically.

5. Provide context:
   - Compare against the full set of penalty tiers for that legislation so the user understands the scale of their exposure
   - Note that actual fines consider proportionality, gravity, duration, and degree of cooperation
   - Clarify which authority (national regulator, sector supervisor, or supranational body) imposes fines under this legislation

6. If the user is unsure about the violation type, help them determine it based on what requirements they might not be meeting, then offer to run `/lexius:compliance` for the relevant obligations checklist.
