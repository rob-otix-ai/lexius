---
description: Interactively classify an AI system's risk level under the EU AI Act
---

# EU AI Act Risk Classification

Guide the user through classifying their AI system under the EU AI Act using the Lexius compliance platform.

## Instructions

1. Ask the user to describe their AI system in 2-3 sentences (what it does, who uses it, what data it processes).

2. Based on their description, ask targeted follow-up questions to gather structured signals. Focus on the most discriminating signals first:
   - Domain: biometrics, critical infrastructure, education, employment, essential services, law enforcement, migration, justice, or other?
   - Does it use biometric identification? If yes, is it real-time? For law enforcement?
   - Does it perform social scoring by a public authority?
   - Does it perform emotion recognition in the workplace or school?
   - Does it generate synthetic content (deepfakes, AI text)?
   - Does it interact directly with people (chatbot, assistant)?
   - Is it a safety component of a regulated product?

3. Call the MCP tool `legalai_classify_system` with the gathered signals and description.

4. Present the result clearly:
   - Risk classification (prohibited / high-risk / limited / minimal)
   - Confidence level
   - Matched Annex III category (if high-risk)
   - Relevant articles with EUR-Lex links
   - Key obligations summary
   - If high-risk, mention the Art. 6(3) exception and ask if the user wants to assess it

5. If classification confidence is medium or low, identify which missing signals would increase confidence and ask those specific questions, then re-classify.

6. If the system is classified as high-risk, offer to run `/lexius:eu-ai-compliance` for a full obligations checklist.
