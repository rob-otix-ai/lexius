---
name: classify
description: Interactively classify a system's risk level under any supported legislation
---

# Risk Classification

Guide the user through classifying their system under a supported legislation using the Lexius compliance platform.

## Instructions

1. Determine the target legislation:
   - If `$ARGUMENTS` contains a legislation hint (e.g. "eu-ai-act", "cima-aml", "dora"), use that.
   - Otherwise, call `legalai_list_legislations` to retrieve the list of available legislations and ask the user which one applies.

2. Ask the user to describe their system in 2-3 sentences (what it does, who uses it, what data it processes).

3. Based on the legislation chosen and their description, ask targeted follow-up questions to gather structured signals. For each legislation the relevant signals differ — use the category structure returned by `legalai_classify_system` as a guide. Common cross-legislation signals include:
   - Primary domain of operation (e.g. financial services, healthcare, law enforcement, public administration)
   - Does the system make or support decisions that materially affect individuals or businesses?
   - Does it process personal, sensitive, or regulated data?
   - What is the scale of deployment and the nature of affected parties?

   **If the legislation is `eu-ai-act`**, additionally probe:
   - Does it use biometric identification? If yes, is it real-time? For law enforcement?
   - Does it perform social scoring by a public authority?
   - Does it perform emotion recognition in the workplace or school?
   - Does it generate synthetic content (deepfakes, AI text)?
   - Is it a safety component of a regulated product?
   - Does it interact directly with people (chatbot, assistant)?

4. Call `legalai_classify_system` with the gathered signals, the description, and the chosen `legislationId`.

5. Present the result clearly:
   - Risk classification (the tier names vary by legislation — report exactly what the tool returns)
   - Confidence level
   - Matched category (if applicable)
   - Relevant article references and any provided links
   - Key obligations summary

   **If the legislation is `eu-ai-act`** and the system is classified as high-risk, mention the Art. 6(3) exception and ask if the user wants to assess it.

6. If classification confidence is medium or low, identify which missing signals would increase confidence and ask those specific questions, then re-classify.

7. If the system is classified at a high or significant risk tier, offer to run `/lexius:compliance` for a full obligations checklist.
