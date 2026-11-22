"""Fixtures that serve the production build for end-to-end tests.

The build in dist/ must exist first; `npm run test:e2e` builds it.
"""

import logging
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path

import pytest
from playwright.sync_api import ConsoleMessage, Page, expect

log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "dist"
STARTUP_TIMEOUT_S = 20.0
# Headless Chromium's software GL driver logs performance notices such as
# "[.WebGL-0x...]GL Driver Message (OpenGL, Performance, ...)".
BROWSER_GL_NOISE = "[.WebGL-"


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_until_serving(url: str, proc: subprocess.Popen[bytes]) -> None:
    deadline = time.monotonic() + STARTUP_TIMEOUT_S
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"preview server exited early with code {proc.returncode}")
        try:
            with urllib.request.urlopen(url, timeout=1):
                return
        except (urllib.error.URLError, ConnectionError):
            time.sleep(0.1)
    raise RuntimeError(f"preview server at {url} did not start within {STARTUP_TIMEOUT_S}s")


@pytest.fixture(scope="session")
def base_url() -> Iterator[str]:
    """Serves dist/ with `vite preview` and yields its URL."""
    if not (DIST / "index.html").exists():
        pytest.fail("dist/index.html is missing; run `npm run build` first")
    npx = shutil.which("npx")
    if npx is None:
        pytest.fail("npx not found on PATH")

    port = _free_port()
    url = f"http://127.0.0.1:{port}/"
    cmd = [npx, "vite", "preview", "--host", "127.0.0.1", "--port", str(port), "--strictPort"]
    log.debug("starting preview server: %s", " ".join(cmd))
    proc = subprocess.Popen(cmd, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    try:
        _wait_until_serving(url, proc)
        log.info("preview server ready at %s", url)
        yield url
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


class ConsoleLog:
    """Collects browser console messages and uncaught page errors."""

    def __init__(self, page: Page) -> None:
        self.messages: list[ConsoleMessage] = []
        self.page_errors: list[str] = []
        # Playwright can't register a builtin method such as list.append directly.
        page.on("console", lambda msg: self.messages.append(msg))
        page.on("pageerror", lambda exc: self.page_errors.append(str(exc)))

    def of_type(self, kind: str) -> list[str]:
        """Messages of one type, minus GPU driver notices that the game didn't emit."""
        return [
            m.text
            for m in self.messages
            if m.type == kind and not m.text.startswith(BROWSER_GL_NOISE)
        ]


@pytest.fixture(autouse=True)
def quick_start(page: Page) -> None:
    """Starts races without the wait in the starting gates, unless a test sets it.

    Most tests aren't about the start, and the wait for the mappa would add
    seconds to each of them. Tests of the start pass race.gate_seconds.
    """
    original = page.goto

    def goto(url: str, **kwargs):  # noqa: ANN202 - mirrors Page.goto
        if "race.gate_seconds" not in url:
            url += ("&" if "?" in url else "?") + "race.gate_seconds=0"
        return original(url, **kwargs)

    page.goto = goto  # type: ignore[method-assign]


def wait_until_rendering(page: Page) -> None:
    """Waits for the game to render its first frame."""
    expect(page.locator("html")).to_have_attribute("data-ready", "true")


def start_race(page: Page) -> None:
    """Waits for the start screen and taps Race."""
    wait_until_rendering(page)
    page.locator("#race-button").click()
    expect(page.locator("#start")).to_be_hidden()


@pytest.fixture
def console(page: Page) -> ConsoleLog:
    return ConsoleLog(page)
