"""Full screen, landscape, the rotate prompt and the Home Screen app."""

from collections.abc import Callable

import pytest
from playwright.sync_api import BrowserContext, Page, expect

from conftest import start_race, wait_until_rendering

LANDSCAPE = {"width": 844, "height": 390}
PORTRAIT = {"width": 390, "height": 844}
IPHONE_UA = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
)

# Records full screen and orientation lock requests instead of making them.
RECORD_FULLSCREEN = """
window.__requests = [];
Element.prototype.requestFullscreen = function () {
    window.__requests.push('fullscreen');
    return Promise.resolve();
};
if (screen.orientation) {
    screen.orientation.lock = (orientation) => {
        window.__requests.push('lock ' + orientation);
        return Promise.resolve();
    };
}
"""


@pytest.fixture
def phone(new_context: Callable[..., BrowserContext]) -> Page:
    return new_context(viewport=LANDSCAPE, has_touch=True).new_page()


def test_portrait_phone_shows_rotate_prompt_and_pauses(phone: Page) -> None:
    # Real full screen would stop the test resizing the window.
    phone.goto("./?display.fullscreen=0")
    start_race(phone)
    phone.wait_for_function("() => window.chariot.state.progress > 0.02")

    phone.set_viewport_size(PORTRAIT)
    expect(phone.locator("#rotate")).to_be_visible()
    phone.wait_for_function("() => window.chariot.paused")
    paused_at = phone.evaluate("() => window.chariot.state.progress")
    phone.wait_for_function("() => window.chariot.frames > 0")
    phone.wait_for_timeout(300)
    assert phone.evaluate("() => window.chariot.state.progress") == paused_at

    phone.set_viewport_size(LANDSCAPE)
    expect(phone.locator("#rotate")).to_be_hidden()
    phone.wait_for_function(f"() => window.chariot.state.progress > {paused_at}")


def test_portrait_phone_prompts_before_start(new_context: Callable[..., BrowserContext]) -> None:
    page = new_context(viewport=PORTRAIT, has_touch=True).new_page()
    page.goto("./")
    wait_until_rendering(page)
    expect(page.locator("#rotate")).to_be_visible()
    expect(page.locator("#rotate")).to_contain_text("Turn your phone sideways")


def test_desktop_window_never_prompts(page: Page) -> None:
    page.set_viewport_size(PORTRAIT)
    page.goto("./")
    wait_until_rendering(page)
    expect(page.locator("#rotate")).to_be_hidden()
    assert not page.evaluate("() => window.chariot.paused")


def test_start_requests_fullscreen_then_landscape(page: Page) -> None:
    page.add_init_script(RECORD_FULLSCREEN)
    page.goto("./")
    start_race(page)
    page.wait_for_function("() => window.__requests.includes('fullscreen')")
    if page.evaluate("() => !!screen.orientation"):
        page.wait_for_function("() => window.__requests.includes('lock landscape')")


def test_fullscreen_can_be_turned_off(page: Page) -> None:
    page.add_init_script(RECORD_FULLSCREEN)
    page.goto("./?display.fullscreen=0")
    start_race(page)
    page.wait_for_timeout(200)
    assert page.evaluate("() => window.__requests") == []


def test_manifest_describes_a_landscape_fullscreen_app(page: Page, base_url: str) -> None:
    response = page.request.get(f"{base_url}manifest.webmanifest")
    assert response.ok
    manifest = response.json()
    assert manifest["display"] == "fullscreen"
    assert manifest["orientation"] == "landscape"
    for icon in manifest["icons"]:
        image = page.request.get(f"{base_url}{icon['src']}")
        assert image.ok, icon["src"]
        assert image.headers["content-type"].startswith("image/"), icon["src"]


def test_page_links_manifest_and_home_screen_icon(page: Page, base_url: str) -> None:
    page.goto("./")
    for selector in ['link[rel="manifest"]', 'link[rel="apple-touch-icon"]']:
        href = page.locator(selector).get_attribute("href")
        assert href is not None
        assert page.request.get(f"{base_url}{href.removeprefix('./')}").ok, selector


def test_iphone_in_safari_shows_home_screen_hint(
    new_context: Callable[..., BrowserContext],
) -> None:
    page = new_context(viewport=LANDSCAPE, has_touch=True, user_agent=IPHONE_UA).new_page()
    page.goto("./")
    wait_until_rendering(page)
    expect(page.locator("#install-hint")).to_be_visible()
    expect(page.locator("#install-hint")).to_contain_text("Add to Home Screen")


def test_other_devices_hide_home_screen_hint(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    expect(page.locator("#install-hint")).to_be_hidden()


def test_canvas_and_drawing_buffer_follow_resize(page: Page) -> None:
    page.set_viewport_size(LANDSCAPE)
    page.goto("./")
    wait_until_rendering(page)
    page.set_viewport_size({"width": 932, "height": 430})
    page.wait_for_function(
        """() => {
            const c = document.querySelector('#game');
            const ratio = window.chariot.config.render.max_pixel_ratio;
            const dpr = Math.min(window.devicePixelRatio, ratio);
            return c.clientWidth === 932 && c.clientHeight === 430
                && c.width === Math.floor(932 * dpr) && c.height === Math.floor(430 * dpr);
        }"""
    )
    box = page.locator("#game").bounding_box()
    assert box == {"x": 0, "y": 0, "width": 932, "height": 430}


def test_overlay_reports_display_details(page: Page) -> None:
    page.set_viewport_size(LANDSCAPE)
    page.goto("./?debug.overlay=1")
    wait_until_rendering(page)
    overlay = page.locator("#overlay")
    expect(overlay).to_contain_text("canvas    844×390")
    expect(overlay).to_contain_text("insets    0 0 0 0")
    expect(overlay).to_contain_text("mode      browser")
