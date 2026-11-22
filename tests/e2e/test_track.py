"""The camera drives around the arena within the performance budget."""

from playwright.sync_api import Page

from conftest import wait_until_rendering

# Performance budget from PLAN.md for an iPhone 12.
MAX_DRAW_CALLS = 100


def test_camera_moves_forward(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    start = page.evaluate("() => window.chariot.progress")
    page.wait_for_function(f"() => window.chariot.progress > {start} + 0.05")


def test_draw_calls_within_budget(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.wait_for_function("() => window.chariot.frames > 5")
    calls = page.evaluate("() => window.chariot.drawCalls")
    assert 0 < calls <= MAX_DRAW_CALLS


def test_start_progress_override(page: Page) -> None:
    page.goto("./?debug.start_progress=1.5")
    wait_until_rendering(page)
    progress = page.evaluate("() => window.chariot.progress")
    assert 1.5 <= progress < 2
