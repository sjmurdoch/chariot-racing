"""The start: the starting gates, the mappa and the staggered grid."""

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

WITH_GATES = "./?race.gate_seconds=1&display.fullscreen=0"


def test_chariots_wait_in_the_gates_until_the_mappa_drops(page: Page) -> None:
    # A long enough wait that the checks below happen inside the gates even
    # on a slow CI runner.
    page.goto("./?race.gate_seconds=3&display.fullscreen=0")
    wait_until_rendering(page)
    page.wait_for_function("() => window.chariot.field.length === 4")
    # Nothing moves on the start screen, so these are the positions in the gates.
    at_gates = page.evaluate("() => window.chariot.field.map((r) => r.progress)")
    start_race(page)
    mappa = page.locator("#mappa")
    expect(mappa).to_be_visible()
    expect(mappa).to_contain_text("Watch for the mappa")
    page.wait_for_timeout(300)
    # Read the phase and positions together, so they describe the same moment.
    phase, progress = page.evaluate(
        "() => [window.chariot.phase, window.chariot.field.map((r) => r.progress)]"
    )
    assert phase == "gates"
    assert progress == at_gates
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


def test_the_start_has_no_invented_latin(page: Page) -> None:
    # The start was signalled by the mappa and the tuba; no spoken command is
    # recorded, so the game doesn't announce one.
    page.goto(WITH_GATES)
    expect(page.locator("#start .subtitle")).to_have_text("Ludi Circenses")
    start_race(page)
    page.wait_for_function("() => window.chariot.phase === 'racing'")
    page.wait_for_timeout(200)
    assert page.evaluate("() => window.chariot.announced") == ""
