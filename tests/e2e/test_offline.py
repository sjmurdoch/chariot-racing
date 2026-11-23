"""Offline play (as a Home Screen app) and the offer of a new version."""

import functools
import shutil
import threading
from collections.abc import Callable, Iterator
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest
from playwright.sync_api import BrowserContext, Page, expect

from conftest import DIST, start_race, wait_until_rendering


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        pass


@pytest.fixture
def own_site(tmp_path: Path) -> Iterator[tuple[str, Path]]:
    """A private copy of the built game, served on its own port, safe to change."""
    root = tmp_path / "site"
    shutil.copytree(DIST, root)
    handler = functools.partial(QuietHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/", root
    finally:
        server.shutdown()


def wait_until_offline_ready(page: Page) -> None:
    page.wait_for_function("() => window.chariot.offline === 'ready'", timeout=20000)
    page.wait_for_function("() => navigator.serviceWorker.ready.then(() => true)")


def test_the_game_keeps_a_copy_for_offline_play(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    wait_until_offline_ready(page)
    page.reload()
    wait_until_rendering(page)
    assert page.evaluate("() => !!navigator.serviceWorker.controller")


def test_the_game_starts_and_races_offline(page: Page, context: BrowserContext) -> None:
    page.goto("./")
    wait_until_rendering(page)
    wait_until_offline_ready(page)
    page.reload()
    wait_until_rendering(page)
    context.set_offline(True)
    try:
        # Settings in the address still work offline.
        page.goto("./?display.fullscreen=0&race.gate_seconds=0")
        wait_until_rendering(page)
        start_race(page)
        page.wait_for_function("() => window.chariot.state.progress > 0.05")
    finally:
        context.set_offline(False)


def test_a_new_version_is_offered_on_the_start_screen(
    new_context: Callable[..., BrowserContext], own_site: tuple[str, Path]
) -> None:
    url, root = own_site
    page = new_context().new_page()
    page.goto(url)
    wait_until_rendering(page)
    wait_until_offline_ready(page)
    page.reload()
    wait_until_rendering(page)
    expect(page.locator("#update")).to_be_hidden()

    # Publish a "new version", then come back to the app.
    sw = root / "sw.js"
    sw.write_text(sw.read_text().replace('const VERSION = "', 'const VERSION = "new-'))
    page.evaluate(
        """() => {
            Object.defineProperty(document, 'visibilityState', {
                value: 'visible',
                configurable: true,
            });
            document.dispatchEvent(new Event('visibilitychange'));
        }"""
    )
    update = page.locator("#update")
    expect(update).to_be_visible(timeout=20000)

    with page.expect_navigation():
        update.click()
    wait_until_rendering(page)
    expect(page.locator("#update")).to_be_hidden()
    version = page.evaluate(
        """() => new Promise((resolve) => {
            navigator.serviceWorker.addEventListener('message', (e) => resolve(e.data.version));
            navigator.serviceWorker.controller.postMessage({ type: 'VERSION' });
        })"""
    )
    assert version.startswith("new-")
