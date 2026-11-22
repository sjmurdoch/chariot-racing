"""Rivals from the other factions race the player."""

import re

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

SHORT_RACE = "./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0"


def test_three_rivals_from_the_other_factions(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.wait_for_function("() => window.chariot.field.length === 4")
    factions = page.evaluate("() => window.chariot.field.map((r) => r.faction)")
    assert factions == ["prasina", "russata", "albata", "veneta"]


def test_player_can_race_for_another_faction(page: Page) -> None:
    page.goto("./?race.faction=russata")
    wait_until_rendering(page)
    page.wait_for_function("() => window.chariot.field.length === 4")
    factions = page.evaluate("() => window.chariot.field.map((r) => r.faction)")
    assert factions[0] == "russata"
    assert sorted(factions[1:]) == ["albata", "prasina", "veneta"]


def test_rivals_race_and_the_hud_shows_the_place(page: Page) -> None:
    page.goto("./")
    start_race(page)
    page.wait_for_function("() => window.chariot.field.every((r) => r.progress > 0.05)")
    expect(page.locator("#hud-place")).to_have_text(re.compile(r"^[1-4](st|nd|rd|th)$"))


def test_rivals_alongside_show_at_the_screen_edges(page: Page) -> None:
    page.goto("./?display.fullscreen=0")
    start_race(page)
    # At the start the rivals are abreast of the player, out of view.
    page.wait_for_function(
        "() => [...document.querySelectorAll('.edge-marker')].some((m) => !m.hidden)"
    )
    sides = page.evaluate(
        "() => [...document.querySelectorAll('.edge-marker')]"
        ".filter((m) => !m.hidden).map((m) => m.dataset.side)"
    )
    assert set(sides) <= {"left", "right"}


def test_finish_shows_the_place(page: Page) -> None:
    page.goto(SHORT_RACE)
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    expect(page.locator("#finish-detail")).to_have_text(re.compile(r"^[1-4](st|nd|rd|th) of 4 · "))
    title = page.locator("#finish .title").inner_text()
    place = page.evaluate("() => window.chariot.field[0].place")
    assert title.upper() == ("VICTOR!" if place == 1 else "FINIS")


def test_racing_alone(page: Page) -> None:
    page.goto(SHORT_RACE + "&rivals.count=0")
    start_race(page)
    assert page.evaluate("() => window.chariot.field.length") == 1
    expect(page.locator("#hud-place")).to_have_text("")
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    expect(page.locator("#finish-detail")).to_have_text(re.compile(r"^(No crashes|\d+ crash)"))
    expect(page.locator(".edge-marker")).to_have_count(0)
