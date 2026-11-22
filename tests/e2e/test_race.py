"""Laps, the race clock, the finish and racing again."""

import re

from playwright.sync_api import Page, expect

from conftest import start_race

# One lap, starting just before the line so the race finishes in seconds.
SHORT_RACE = "./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0"


def test_shows_lap_and_time_in_roman_style(page: Page) -> None:
    page.goto("./")
    start_race(page)
    expect(page.locator("#hud-lap")).to_have_text("Lap I of VII")
    expect(page.locator("#hud-time")).to_have_text(re.compile(r"^0:0[1-9]\.\d$"))


def test_finishes_after_the_last_lap(page: Page) -> None:
    page.goto(SHORT_RACE)
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    finish = page.locator("#finish")
    expect(finish).to_be_visible()
    expect(finish).to_contain_text("Finis")
    finish_time = page.evaluate("() => window.chariot.race.finishTime")
    assert 0 < finish_time < 10
    expect(page.locator("#finish-time")).to_have_text(re.compile(r"^0:0\d\.\d$"))
    expect(page.locator("#hud")).to_be_hidden()
    # The chariot pulls up after the line and the clock stops.
    page.wait_for_function("() => window.chariot.state.speed === 0", timeout=15000)
    assert page.evaluate("() => window.chariot.race.elapsed") == finish_time


def test_race_again_resets_to_the_start(page: Page) -> None:
    page.goto(SHORT_RACE)
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    page.locator("#again").click()
    expect(page.locator("#finish")).to_be_hidden()
    expect(page.locator("#hud")).to_be_visible()
    race = page.evaluate("() => window.chariot.race")
    assert race["phase"] == "racing"
    assert race["lapsDone"] == 0
    assert page.evaluate("() => window.chariot.state.crashes") == 0
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")


def test_enter_races_again_from_the_finish(page: Page) -> None:
    page.goto(SHORT_RACE)
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    page.keyboard.press("Enter")
    expect(page.locator("#finish")).to_be_hidden()


def test_eggs_and_dolphins_count_the_leaders_laps(page: Page) -> None:
    page.goto("./?rivals.count=0&debug.start_progress=3.95&display.fullscreen=0")
    start_race(page)
    assert page.evaluate("() => window.chariot.lapsCounted") == 0
    page.wait_for_function("() => window.chariot.lapsCounted === 1")
