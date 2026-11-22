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
    assert page.evaluate("() => window.chariot.input") == {"steer": 1, "source": "keyboard"}
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


def test_lane_stays_on_track(page: Page) -> None:
    page.goto("./?steering.max_lateral_speed=40")
    start_race(page)
    page.keyboard.down("ArrowLeft")
    page.wait_for_function("() => window.chariot.state.lane === 0")
    page.keyboard.up("ArrowLeft")
    assert lane(page) == 0
