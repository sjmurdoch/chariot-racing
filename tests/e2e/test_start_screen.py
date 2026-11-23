"""Choosing a faction and difficulty on the start screen."""

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

SHORT_RACE = "./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0"


def checked(page: Page, selector: str) -> str | None:
    return page.locator(f"{selector}[aria-checked='true']").get_attribute("data-faction") or (
        page.locator(f"{selector}[aria-checked='true']").get_attribute("data-difficulty")
    )


def test_defaults_are_green_and_normal(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    assert checked(page, "#faction-choice button") == "prasina"
    assert checked(page, "#difficulty-choice button") == "normal"


def test_choosing_a_faction_changes_the_field_and_is_remembered(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.locator("#faction-choice [data-faction='veneta']").click()
    assert checked(page, "#faction-choice button") == "veneta"
    page.wait_for_function("() => window.chariot.field[0]?.faction === 'veneta'")
    factions = page.evaluate("() => window.chariot.field.map((r) => r.faction)")
    assert "prasina" in factions[1:]

    page.locator("#difficulty-choice [data-difficulty='hard']").click()
    page.reload()
    wait_until_rendering(page)
    assert checked(page, "#faction-choice button") == "veneta"
    assert checked(page, "#difficulty-choice button") == "hard"
    assert page.evaluate("() => window.chariot.choices") == {
        "faction": "veneta",
        "difficulty": "hard",
        "sound": True,
    }


def test_url_setting_wins_over_the_remembered_choice(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.locator("#faction-choice [data-faction='veneta']").click()
    page.goto("./?race.faction=albata")
    wait_until_rendering(page)
    assert checked(page, "#faction-choice button") == "albata"


def test_enter_on_a_choice_picks_it_without_starting(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.locator("#faction-choice [data-faction='russata']").focus()
    page.keyboard.press("Enter")
    assert checked(page, "#faction-choice button") == "russata"
    expect(page.locator("#start")).to_be_visible()
    assert not page.evaluate("() => window.chariot.started")


def test_choose_a_new_faction_after_a_race(page: Page) -> None:
    page.goto(SHORT_RACE)
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    page.locator("#menu").click()
    expect(page.locator("#start")).to_be_visible()
    expect(page.locator("#finish")).to_be_hidden()
    page.locator("#faction-choice [data-faction='albata']").click()
    start_race(page)
    assert page.evaluate("() => window.chariot.field[0].faction") == "albata"
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
