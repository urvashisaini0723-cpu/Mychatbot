---
name: Groq model availability
description: How to keep Groq-backed assistants resilient when model access varies by account.
---

Do not assume the model named in a product brief is available to every Groq key. A valid key can return `model_not_found` when the account lacks access or the provider has retired a model.

**Why:** The DAV Pundri assistant's requested model and a common fallback were both rejected by the configured account even though authentication succeeded.

**How to apply:** Keep the requested model configurable, query the provider's model list server-side when no explicit accessible model is known, and choose a documented preferred fallback without exposing credentials.