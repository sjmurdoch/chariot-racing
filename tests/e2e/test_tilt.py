"""Tilt steering, with the iOS permission prompt and sensor events simulated.

Desktop browsers have no motion sensor, so each test stubs
DeviceOrientationEvent.requestPermission (as on iOS), sets the screen to
landscape, and dispatches synthetic deviceorientation events.
"""

import math

import pytest
from playwright.sync_api import Page, expect

from conftest import start_race, wait_until_rendering

START_LANE = 6

STUB_SENSOR = """
(answer) => {
    if (typeof window.DeviceOrientationEvent === 'undefined') {
        window.DeviceOrientationEvent = class DeviceOrientationEvent extends Event {};
    }
    window.DeviceOrientationEvent.requestPermission = async () => answer;
    // Landscape, turned anticlockwise (top of the phone to the left).
    Object.defineProperty(window, 'orientation', { value: 90, configurable: true });
}
"""


def landscape_reading(turn: float, lean: float = 30) -> dict[str, float]:
    """beta and gamma for a landscape phone leaned back and turned clockwise."""
    in_plane = math.cos(math.radians(lean))
    # "Up" on screen, then rotated back into device axes for a 90° screen.
    sx = -math.sin(math.radians(turn)) * in_plane
    sy = math.cos(math.radians(turn)) * in_plane
    dx, dy = sy, -sx
    beta = math.asin(dy)
    gamma = math.asin(-dx / math.cos(beta))
    return {"beta": math.degrees(beta), "gamma": math.degrees(gamma)}


def tilt_to(page: Page, turn: float, times: int = 10) -> None:
    """Sends several identical readings, so smoothing settles."""
    reading = landscape_reading(turn)
    page.evaluate(
        """([reading, times]) => {
            for (let i = 0; i < times; i++) {
                const event = new Event('deviceorientation');
                Object.defineProperty(event, 'beta', { value: reading.beta });
                Object.defineProperty(event, 'gamma', { value: reading.gamma });
                window.dispatchEvent(event);
            }
        }""",
        [reading, times],
    )


def open_with_sensor(page: Page, answer: str) -> None:
    page.add_init_script(f"({STUB_SENSOR})({answer!r})")
    page.goto("./")
    wait_until_rendering(page)


@pytest.fixture
def tilting(page: Page) -> Page:
    open_with_sensor(page, "granted")
    start_race(page)
    page.wait_for_function("() => window.chariot.tilt.status === 'granted'")
    tilt_to(page, 0)
    return page


def test_turning_clockwise_steers_right(tilting: Page) -> None:
    tilt_to(tilting, 20)
    tilting.wait_for_function(
        "() => window.chariot.input.source === 'tilt' && window.chariot.input.steer > 0.5"
    )
    tilting.wait_for_function(f"() => window.chariot.state.lane > {START_LANE + 1}")


def test_turning_anticlockwise_steers_left(tilting: Page) -> None:
    tilt_to(tilting, -20)
    tilting.wait_for_function(f"() => window.chariot.state.lane < {START_LANE - 1}")


def test_level_phone_drives_straight(tilting: Page) -> None:
    tilting.wait_for_function("() => window.chariot.state.progress > 0.05")
    assert tilting.evaluate("() => window.chariot.input.steer") == 0
    assert tilting.evaluate("() => window.chariot.state.lane") == START_LANE


def test_neutral_is_calibrated_at_start(page: Page) -> None:
    open_with_sensor(page, "granted")
    tilt_to(page, 10)  # Not yet listening: before the start tap.
    start_race(page)
    page.wait_for_function("() => window.chariot.tilt.status === 'granted'")
    tilt_to(page, 10)  # The player holds the phone turned 10° throughout.
    page.wait_for_function("() => window.chariot.tilt.neutral !== null")
    assert page.evaluate("() => window.chariot.tilt.neutral") == pytest.approx(10, abs=0.5)
    assert page.evaluate("() => window.chariot.input.steer") == 0


def test_keyboard_overrides_tilt(tilting: Page) -> None:
    tilt_to(tilting, 20)
    tilting.keyboard.down("ArrowLeft")
    tilting.wait_for_function("() => window.chariot.input.source === 'keyboard'")
    # Keys ramp up to full lock, overriding the tilt the whole time.
    tilting.wait_for_function(
        "() => window.chariot.input.source === 'keyboard' && window.chariot.input.steer === -1"
    )
    tilting.keyboard.up("ArrowLeft")


def test_denied_permission_still_races(page: Page) -> None:
    open_with_sensor(page, "denied")
    start_race(page)
    page.wait_for_function("() => window.chariot.tilt.status === 'denied'")
    expect(page.locator("#start")).to_be_hidden()
    page.keyboard.down("ArrowRight")
    page.wait_for_function(f"() => window.chariot.state.lane > {START_LANE + 1}")
    page.keyboard.up("ArrowRight")


def test_race_waits_for_permission_answer(page: Page) -> None:
    page.add_init_script(
        """
        window.DeviceOrientationEvent ??= class DeviceOrientationEvent extends Event {};
        window.DeviceOrientationEvent.requestPermission = () =>
            new Promise((resolve) => { window.answerPermission = resolve; });
        """
    )
    page.goto("./")
    wait_until_rendering(page)
    page.locator("#race-button").click()
    expect(page.locator("#start .waiting-note")).to_be_visible()
    page.wait_for_timeout(500)
    assert not page.evaluate("() => window.chariot.started")
    assert page.evaluate("() => window.chariot.state.progress") == 0

    page.evaluate("() => window.answerPermission('granted')")
    expect(page.locator("#start")).to_be_hidden()
    page.wait_for_function("() => window.chariot.state.progress > 0.01")
