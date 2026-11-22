"""The debug overlay shows build and game facts, and can be toggled."""

import os
import subprocess
from collections.abc import Callable

from playwright.sync_api import BrowserContext, Page, expect

from conftest import ROOT, wait_until_rendering


def expected_commit() -> str:
    """The commit this test run's build should report."""
    sha = os.environ.get("GITHUB_SHA")
    if sha:
        return sha[:7]
    head = subprocess.run(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return head.stdout.strip()[:7]


def test_hidden_by_default(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    expect(page.locator("#overlay")).to_be_hidden()


def test_url_parameter_shows_overlay_with_commit(page: Page) -> None:
    page.goto("./?debug.overlay=1")
    wait_until_rendering(page)
    overlay = page.locator("#overlay")
    expect(overlay).to_be_visible()
    # Builds from uncommitted changes add "-dirty", so match the prefix.
    expect(overlay).to_contain_text(f"commit    {expected_commit()}")
    expect(overlay).to_contain_text("fps")
    expect(overlay).to_contain_text("lap       1 of 7")
    expect(overlay).to_contain_text("set       debug.overlay=true (URL)")


def test_embedded_commit_matches_checkout(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    build = page.evaluate("() => window.chariot.build")
    assert build["commit"].startswith(expected_commit())
    assert build["builtAt"].endswith("Z")


def test_backquote_toggles_overlay(page: Page) -> None:
    page.goto("./")
    wait_until_rendering(page)
    overlay = page.locator("#overlay")
    page.keyboard.press("Backquote")
    expect(overlay).to_be_visible()
    expect(overlay).to_contain_text("commit")
    page.keyboard.press("Backquote")
    expect(overlay).to_be_hidden()


def test_three_finger_tap_toggles_overlay(new_context: Callable[..., BrowserContext]) -> None:
    page = new_context(has_touch=True).new_page()
    page.goto("./")
    wait_until_rendering(page)
    # Desktop WebKit can't construct Touch objects (iOS Safari can), and the
    # handler only counts touches, so dispatch a touchstart carrying three.
    page.evaluate(
        """() => {
            const event = new Event('touchstart');
            Object.defineProperty(event, 'touches', { value: { length: 3 } });
            window.dispatchEvent(event);
        }"""
    )
    expect(page.locator("#overlay")).to_be_visible()
