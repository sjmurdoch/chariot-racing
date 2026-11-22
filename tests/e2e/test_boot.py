"""The game loads, renders with WebGL and honours URL config overrides."""

from playwright.sync_api import Page, expect

from conftest import ConsoleLog, wait_until_rendering


def test_loads_and_renders_without_errors(page: Page, console: ConsoleLog) -> None:
    page.goto("./")
    wait_until_rendering(page)

    expect(page).to_have_title("Circus Maximus")
    has_webgl = page.evaluate("() => !!document.querySelector('#game').getContext('webgl2')")
    assert has_webgl
    page.wait_for_function("() => window.chariot.frames > 5")
    assert console.page_errors == []
    assert console.of_type("error") == []
    assert console.of_type("warning") == []


def test_canvas_fills_viewport(page: Page) -> None:
    page.set_viewport_size({"width": 844, "height": 390})  # iPhone 12, landscape
    page.goto("./")
    wait_until_rendering(page)
    box = page.locator("#game").bounding_box()
    assert box == {"x": 0, "y": 0, "width": 844, "height": 390}


def test_url_overrides_config(page: Page, console: ConsoleLog) -> None:
    page.goto("./?race.laps=2&debug.show_fps=1")
    wait_until_rendering(page)
    assert page.evaluate("() => window.chariot.config.race.laps") == 2
    expect(page.locator("#fps")).to_be_visible()
    expect(page.locator("#fps")).to_contain_text("fps")
    assert console.of_type("warning") == []


def test_bad_url_override_warns_and_keeps_default(page: Page, console: ConsoleLog) -> None:
    page.goto("./?race.laps=seven&race.lapz=3")
    wait_until_rendering(page)
    assert page.evaluate("() => window.chariot.config.race.laps") == 7
    warnings = console.of_type("warning")
    assert len(warnings) == 2
    assert any('"race.laps"' in w for w in warnings)
    assert any('"race.lapz"' in w for w in warnings)


def test_fps_counter_hidden_by_default(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    expect(page.locator("#fps")).to_be_hidden()
