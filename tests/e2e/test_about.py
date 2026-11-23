"""Historical facts, with sources, and the About screen."""

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering


def test_the_start_screen_shows_a_fact(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    fact = page.locator("#start-fact")
    expect(fact).to_be_visible()
    assert len(fact.inner_text()) > 20


def test_the_finish_shows_a_fact(page: Page) -> None:
    page.goto("./?race.laps=1&debug.start_progress=3.85&display.fullscreen=0")
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'")
    assert len(page.locator("#finish-fact").inner_text()) > 20


def test_about_lists_every_fact_with_its_source(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.locator("#about-button").click()
    about = page.locator("#about")
    expect(about).to_be_visible()
    # Opens at the top, not scrolled down to the Close button.
    assert page.evaluate("() => document.querySelector('#about').scrollTop") == 0
    facts = page.locator("#about-facts li")
    assert facts.count() >= 10
    for i in range(facts.count()):
        link = facts.nth(i).locator("a.source")
        assert link.get_attribute("href").startswith("https://")
        assert link.get_attribute("target") == "_blank"
    expect(page.locator("#about-departures li").first).to_be_visible()
    commit = page.evaluate("() => window.chariot.build.commit")
    expect(page.locator("#about-build")).to_contain_text(commit)


def test_about_closes_without_starting_a_race(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.locator("#about-button").click()
    page.keyboard.press("Enter")  # Presses Close, which has focus.
    expect(page.locator("#about")).to_be_hidden()
    expect(page.locator("#start")).to_be_visible()
    assert page.evaluate("() => window.chariot.phase") == "menu"
    page.locator("#about-button").click()
    page.keyboard.press("Escape")
    expect(page.locator("#about")).to_be_hidden()
