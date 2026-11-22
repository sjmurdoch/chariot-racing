"""Wreckage (naufragia): left by fast crashes, and a crash to run into."""

from playwright.sync_api import Page, expect

from conftest import start_race

ALONE = "./?display.fullscreen=0&rivals.count=0"


def test_a_fast_crash_into_the_wall_leaves_wreckage(page: Page) -> None:
    page.goto(ALONE)
    start_race(page)
    page.wait_for_function("() => window.chariot.state.speed > 15")
    page.keyboard.down("ArrowRight")
    page.wait_for_function("() => window.chariot.state.crashes === 1")
    page.keyboard.up("ArrowRight")
    expect(page.locator("#crash-flash")).to_have_class("flash")
    expect(page.locator(".crash-word")).to_have_text("Naufragium!")
    wrecks = page.evaluate("() => window.chariot.wrecks")
    width = page.evaluate("() => window.chariot.config.track.width")
    assert len(wrecks) == 1
    assert wrecks[0]["lane"] == width


def test_running_into_wreckage_is_a_crash(page: Page) -> None:
    # A wreck at the spina just ahead, and the player on the inside line.
    page.goto(ALONE + "&debug.wreck_at=0.15&chariot.start_lane=2")
    start_race(page)
    page.wait_for_function("() => window.chariot.state.crashes === 1")
    # Knocked clear, out onto the open track (the hook blends between steps,
    # so wait for the next frame to settle).
    page.wait_for_function("() => window.chariot.state.lane > 3")
    # Running into wreckage leaves no more of it.
    assert len(page.evaluate("() => window.chariot.wrecks")) == 1


def test_steering_round_wreckage_avoids_it(page: Page) -> None:
    page.goto(ALONE + "&debug.wreck_at=0.15&chariot.start_lane=8")
    start_race(page)
    page.wait_for_function("() => window.chariot.state.progress > 0.25")
    assert page.evaluate("() => window.chariot.state.crashes") == 0


def test_rivals_steer_round_wreckage(page: Page) -> None:
    # The inside rival's line runs straight into wreckage at the spina.
    page.goto("./?display.fullscreen=0&debug.wreck_at=0.3")
    start_race(page)
    page.wait_for_function(
        "() => window.chariot.field.find((r) => r.faction === 'russata').progress > 0.45"
    )
    russata = page.evaluate("() => window.chariot.field.find((r) => r.faction === 'russata')")
    assert russata["crashes"] == 0


def test_wreckage_is_cleared_away(page: Page) -> None:
    page.goto(ALONE + "&debug.wreck_at=0.6&wreckage.lifetime=1")
    start_race(page)
    page.wait_for_function("() => window.chariot.wrecks.length === 0")
