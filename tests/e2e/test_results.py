"""The finish: standings, the palm branch for a win, and best times."""

import re

from playwright.sync_api import Page, expect

from conftest import start_race

SHORT_RACE = "./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0"


def finish_race(page: Page) -> None:
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'", timeout=20000)


def test_standings_list_every_chariot(page: Page) -> None:
    page.goto(SHORT_RACE)
    finish_race(page)
    rows = page.locator("#standings li")
    expect(rows).to_have_count(4)
    expect(page.locator("#standings li.player")).to_contain_text("Prasina (you)")
    expect(rows.first).to_contain_text("1st")
    # Rivals still racing fill in their times as they finish.
    page.wait_for_function(
        "() => [...document.querySelectorAll('#standings .when')]"
        ".every((e) => /^\\d:\\d\\d\\.\\d$/.test(e.textContent))",
        timeout=20000,
    )


def test_a_win_earns_the_palm_branch(page: Page) -> None:
    # A few metres from the line, against only the inside rival, whose stall
    # is behind the player's, at half speed: the player can't help but win.
    page.goto(
        "./?race.laps=1&debug.start_progress=3.9&display.fullscreen=0"
        "&rivals.count=1&rivals.skill=0.5"
    )
    finish_race(page)
    expect(page.locator("#finish .title")).to_have_text("Victor!")
    expect(page.locator("#palm")).to_be_visible()


def test_no_palm_without_a_win(page: Page) -> None:
    page.goto(SHORT_RACE + "&rivals.skill=1.6")
    finish_race(page)
    expect(page.locator("#finish .title")).to_have_text("Finis")
    expect(page.locator("#palm")).to_be_hidden()


def test_best_times_are_kept(page: Page) -> None:
    page.goto(SHORT_RACE + "&rivals.count=0")
    finish_race(page)
    expect(page.locator("#finish-best")).to_have_text("First time on the board")
    first = page.evaluate("() => window.chariot.lastResult.time")

    page.locator("#again").click()
    page.wait_for_function("() => window.chariot.race.phase === 'finished'", timeout=20000)
    second = page.evaluate("() => window.chariot.lastResult")
    if second["isBest"]:
        expect(page.locator("#finish-best")).to_have_text("New best time!")
    else:
        expect(page.locator("#finish-best")).to_have_text(re.compile(r"^Best \d:\d\d\.\d$"))
        assert second["time"] >= first
