"""The chariot drives round the arena within the performance budget."""

from playwright.sync_api import Page

from conftest import start_race, wait_until_rendering

# Performance budget from PLAN.md for an iPhone 12.
MAX_DRAW_CALLS = 100


def test_waits_on_start_screen(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    at_gates = page.evaluate("() => window.chariot.state.progress")
    page.wait_for_function("() => window.chariot.frames > 10")
    assert page.evaluate("() => window.chariot.state.progress") == at_gates
    # The player starts a little ahead of the inside rival: the gates are staggered.
    assert 0 < at_gates < 0.05


def test_moves_forward_after_start(page: Page) -> None:
    page.goto("./")
    start_race(page)
    page.wait_for_function("() => window.chariot.state.progress > 0.05")


def test_draw_calls_within_budget(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.wait_for_function("() => window.chariot.frames > 5")
    calls = page.evaluate("() => window.chariot.drawCalls")
    assert 0 < calls <= MAX_DRAW_CALLS


def test_start_progress_override(page: Page) -> None:
    page.goto("./?debug.start_progress=1.5")
    wait_until_rendering(page)
    progress = page.evaluate("() => window.chariot.state.progress")
    # Starts there, plus the player's stagger in the starting gates.
    assert 1.5 < progress < 1.6
