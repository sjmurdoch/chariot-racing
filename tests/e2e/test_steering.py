"""Steering with the keyboard and by holding either half of the screen."""

from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

START_LANE = 6


def lane(page: Page) -> float:
    return page.evaluate("() => window.chariot.state.lane")


def test_any_key_starts_the_race(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    page.keyboard.press("Space")
    expect(page.locator("#start")).to_be_hidden()
    assert page.evaluate("() => window.chariot.started")


def test_arrow_keys_steer(page: Page) -> None:
    page.goto("./")
    start_race(page)

    page.keyboard.down("ArrowRight")
    page.wait_for_function(f"() => window.chariot.state.lane > {START_LANE + 2}")
    assert page.evaluate("() => window.chariot.input.source") == "keyboard"
    # A held key builds up to full lock rather than jumping there.
    page.wait_for_function("() => window.chariot.input.steer === 1")
    page.keyboard.up("ArrowRight")

    page.keyboard.down("KeyA")
    page.wait_for_function(f"() => window.chariot.state.lane < {START_LANE}")
    page.keyboard.up("KeyA")
    page.wait_for_function("() => window.chariot.input.source === 'none'")


def test_holding_right_half_steers_right(page: Page) -> None:
    page.set_viewport_size({"width": 844, "height": 390})
    page.goto("./")
    start_race(page)

    page.mouse.move(700, 200)
    page.mouse.down()
    page.wait_for_function(f"() => window.chariot.state.lane > {START_LANE + 2}")
    assert page.evaluate("() => window.chariot.input.source") == "touch"
    page.mouse.up()
    page.wait_for_function("() => window.chariot.input.source === 'none'")


def test_holding_left_half_steers_left(page: Page) -> None:
    page.set_viewport_size({"width": 844, "height": 390})
    page.goto("./")
    start_race(page)

    page.mouse.move(100, 200)
    page.mouse.down()
    page.wait_for_function(f"() => window.chariot.state.lane < {START_LANE - 2}")
    page.mouse.up()


def test_hitting_the_spina_is_a_crash(page: Page) -> None:
    page.goto("./")
    start_race(page)
    page.keyboard.down("ArrowLeft")
    page.wait_for_function("() => window.chariot.state.crashes >= 1")
    page.keyboard.up("ArrowLeft")
    state = page.evaluate("() => window.chariot.state")
    # Knocked clear of the spina rather than left scraping along it.
    assert state["lane"] > 0
    expect(page.locator("#crash-flash")).to_have_class("flash")


def test_runs_wide_into_the_wall_without_steering(page: Page) -> None:
    page.goto("./?debug.start_progress=0.9")
    start_race(page)
    page.wait_for_function("() => window.chariot.state.crashes === 1", timeout=15000)
    assert page.evaluate("() => window.chariot.input.source") == "none"
    width = page.evaluate("() => window.chariot.config.track.width")
    assert page.evaluate("() => window.chariot.state.lane") < width
