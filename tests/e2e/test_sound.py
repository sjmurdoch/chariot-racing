"""Sound: set up by the start tap, and switched on or off on the start screen."""

from playwright.sync_api import Page, expect

from conftest import ConsoleLog, start_race, wait_until_rendering


def test_sound_starts_with_the_race(page: Page, console: ConsoleLog) -> None:
    page.goto("./?display.fullscreen=0")
    wait_until_rendering(page)
    assert page.evaluate("() => window.chariot.sound") == "off"
    start_race(page)
    # The start tap sets up the audio; browsers may still hold it suspended.
    page.wait_for_function("() => window.chariot.sound !== 'off'")
    assert page.evaluate("() => window.chariot.sound") in ("running", "suspended")
    page.wait_for_function("() => window.chariot.state.speed > 15")
    assert console.page_errors == []
    assert console.of_type("error") == []


def test_sound_can_be_turned_off_and_is_remembered(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    toggle = page.locator("#sound-toggle")
    expect(toggle).to_have_text("Sound on")
    toggle.click()
    expect(toggle).to_have_text("Sound off")
    expect(toggle).to_have_attribute("aria-pressed", "false")
    page.reload()
    wait_until_rendering(page)
    expect(page.locator("#sound-toggle")).to_have_text("Sound off")


def test_sound_setting_in_the_url(page: Page) -> None:
    page.goto("./?audio.enabled=0")
    wait_until_rendering(page)
    expect(page.locator("#sound-toggle")).to_have_text("Sound off")


def test_a_crash_and_finish_play_without_errors(page: Page, console: ConsoleLog) -> None:
    page.goto("./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0")
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'", timeout=20000)
    assert console.page_errors == []
    assert console.of_type("error") == []
