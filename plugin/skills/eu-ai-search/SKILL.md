---
description: Search EU AI Act regulation text using semantic similarity
---

# EU AI Act Knowledge Search

Search the EU AI Act regulation text semantically to find relevant articles, obligations, and FAQ answers.

## Instructions

1. Ask the user what they want to know about the EU AI Act. Accept natural language questions.

2. Determine the best search strategy:
   - If asking about a specific article number, use `legalai_get_article` directly
   - If asking a general question, first try `legalai_answer_question` (FAQ search)
   - If FAQ doesn't match well, use `legalai_search_knowledge` with appropriate entity type:
     - "article" for regulation text
     - "obligation" for requirements
     - "faq" for common questions
     - "risk-category" for classification details

3. Present results with:
   - The matched content
   - Article references
   - EUR-Lex deep links for verification
   - Similarity scores (for semantic results) to indicate confidence

4. If the user's question spans multiple topics, run multiple searches and synthesise the results.

5. Always encourage the user to verify against the official regulation text via the provided EUR-Lex links.
