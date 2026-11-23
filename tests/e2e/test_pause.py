"""Pausing a race, and resuming, restarting or leaving it."""

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

RACE = "./?display.fullscreen=0"


def snapshot(page: Page) -> tuple[float, float]:
    """The player's progress and the race clock, read at the same moment."""
    return tuple(
        page.evaluate("() => [window.chariot.state.progress, window.chariot.race.elapsed]")
    )


def race_under_way(page: Page) -> None:
    page.goto(RACE)
    start_race(page)
    page.wait_for_function("() => window.chariot.race.elapsed > 1")


def test_no_pause_button_on_the_start_screen(page: Page) -> None:
    page.goto(RACE)
    wait_until_rendering(page)
    expect(page.locator("#pause-button")).to_be_hidden()


def test_pause_holds_the_race_still_and_resume_carries_on(page: Page) -> None:
    race_under_way(page)
    page.locator("#pause-button").click()
    pause = page.locator("#pause")
    expect(pause).to_be_visible()
    expect(pause).to_contain_text("Pausa")
    expect(page.locator("#pause-button")).to_be_hidden()
    held = snapshot(page)
    page.wait_for_timeout(400)
    assert snapshot(page) == held

    page.locator("#resume").click()
    expect(pause).to_be_hidden()
    page.wait_for_function(f"() => window.chariot.race.elapsed > {held[1]} + 0.2")


def test_restart_goes_back_to_the_starting_gates(page: Page) -> None:
    race_under_way(page)
    page.locator("#pause-button").click()
    page.locator("#restart").click()
    expect(page.locator("#pause")).to_be_hidden()
    race = page.evaluate("() => window.chariot.race")
    assert race["lapsDone"] == 0
    assert race["elapsed"] < 0.5
    page.wait_for_function("() => window.chariot.phase === 'racing'")


def test_choose_faction_from_the_pause_screen(page: Page) -> None:
    race_under_way(page)
    page.locator("#pause-button").click()
    page.locator("#pause-menu").click()
    expect(page.locator("#start")).to_be_visible()
    expect(page.locator("#pause")).to_be_hidden()
    assert page.evaluate("() => window.chariot.phase") == "menu"


def test_escape_pauses_and_resumes(page: Page) -> None:
    race_under_way(page)
    page.keyboard.press("Escape")
    expect(page.locator("#pause")).to_be_visible()
    page.keyboard.press("KeyP")
    expect(page.locator("#pause")).to_be_hidden()


def test_leaving_the_app_pauses_the_race(page: Page) -> None:
    race_under_way(page)
    page.evaluate(
        """() => {
            Object.defineProperty(document, 'visibilityState', {
                value: 'hidden',
                configurable: true,
            });
            document.dispatchEvent(new Event('visibilitychange'));
        }"""
    )
    expect(page.locator("#pause")).to_be_visible()
    assert page.evaluate("() => window.chariot.pausedByPlayer")


def test_no_pause_after_the_finish(page: Page) -> None:
    page.goto("./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0")
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    expect(page.locator("#pause-button")).to_be_hidden()
    page.keyboard.press("Escape")
    expect(page.locator("#pause")).to_be_hidden()
