"""message_content_text: plain strings and provider content blocks."""

from __future__ import annotations

from utils.message_text import message_content_text


def test_plain_string_passthrough() -> None:
    assert message_content_text("Ravel\n\nOpening line.") == "Ravel\n\nOpening line."


def test_extracts_text_from_content_blocks() -> None:
    content = [
        {
            "type": "text",
            "text": (
                "Ravel\n\n"
                "They didn’t have to prove her wrong; they only had to ensure no one listened."
            ),
            "extras": {
                "signature": "EnMKcQFpFH0TyR9rVfuL4EAnFPyQVWGVjfd3QuLqON08oXyi7MaPP4536XoxkzMPjWP+"
            },
        }
    ]
    assert message_content_text(content).startswith("Ravel\n\nThey")
    assert "signature" not in message_content_text(content)
    assert "extras" not in message_content_text(content)


def test_skips_non_text_blocks() -> None:
    content = [
        {"type": "tool_use", "id": "1", "name": "retrieve", "input": {}},
        {"type": "text", "text": "Final prose."},
    ]
    assert message_content_text(content) == "Final prose."


def test_object_blocks_with_text_attr() -> None:
    class Block:
        type = "text"
        text = "From object."

    assert message_content_text([Block()]) == "From object."


def test_none_and_empty() -> None:
    assert message_content_text(None) == ""
    assert message_content_text([]) == ""
