---
description: Calculate maximum penalty exposure under the EU AI Act
---

# EU AI Act Penalty Assessment

Calculate the maximum penalty exposure for a given violation type and organisation profile.

## Instructions

1. Ask the user:
   - What type of violation? (prohibited practice / high-risk non-compliance / providing false information)
   - What is their organisation's annual global turnover in EUR?
   - Are they an SME or startup?

2. Call `legalai_calculate_penalty` with the provided information.

3. Present the result:
   - Maximum fine amount
   - How it was calculated (fixed amount vs percentage of turnover)
   - Whether SME reduction was applied (Art. 99(6))
   - The relevant article reference

4. Provide context:
   - Compare against the three penalty tiers so the user understands the scale
   - Note that actual fines consider proportionality, gravity, and cooperation
   - Mention that national authorities (not the EU directly) impose fines

5. If the user is unsure about the violation type, help them determine it based on what requirements they might not be meeting.
