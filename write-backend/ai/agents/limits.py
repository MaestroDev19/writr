"""Shared agent run limits (v1)."""

# Caps model↔tool loops. create_agent ships with 9999; keep v1 tight.
DEFAULT_RECURSION_LIMIT = 12
