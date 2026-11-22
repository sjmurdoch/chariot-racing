"""The start: the starting gates, the mappa and the staggered grid."""

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

WITH_GATES = "./?race.gate_seconds=1&display.fullscreen=0"


def test_chariots_wait_in_the_gates_until_the_mappa_drops(page: Page) -> None:
    page.goto(WITH_GATES)
    start_race(page)
    assert page.evaluate("() => window.chariot.phase") == "gates"
    mappa = page.locator("#mappa")
    expect(mappa).to_be_visible()
    expect(mappa).to_contain_text("Watch for the mappa")
    at_gates = page.evaluate("() => window.chariot.field.map((r) => r.progress)")
    page.wait_for_timeout(500)
    assert page.evaluate("() => window.chariot.field.map((r) => r.progress)") == at_gates
    expect(page.locator("#hud-time")).to_have_text("0:00.0")

    page.wait_for_function("() => window.chariot.phase === 'racing'")
    expect(mappa).to_have_class("dropped")
    page.wait_for_function(
        f"() => window.chariot.field.every((r, i) => r.progress > {at_gates}[i])"
    )


def test_racing_again_goes_back_into_the_gates(page: Page) -> None:
    page.goto("./?race.gate_seconds=1&race.laps=1&debug.start_progress=3.85&display.fullscreen=0")
    start_race(page)
    page.wait_for_function("() => window.chariot.race.phase === 'finished'", timeout=20000)
    page.locator("#again").click()
    assert page.evaluate("() => window.chariot.phase") == "gates"
    expect(page.locator("#mappa")).to_be_visible()
    page.wait_for_function("() => window.chariot.phase === 'racing'")


def test_outer_chariots_start_further_forward(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.wait_for_function("() => window.chariot.field.length === 4")
    field = page.evaluate("() => window.chariot.field")
    by_lane = sorted(field, key=lambda r: r["lane"])
    progress = [r["progress"] for r in by_lane]
    assert progress == sorted(progress)
    assert progress[0] < progress[-1]
