"""
Thin client for Open Food Facts (https://world.openfoodfacts.org), a free, open,
crowd-sourced product database — no API key required. Given a barcode, it returns the
product name, ingredient list, and NOVA processing group (1-4) computed by Open Food
Facts itself, which we use to pre-fill a food log entry so the user can review and
confirm rather than re-typing an ingredient list by hand.

This is the "automation" lever for reducing logging friction: a barcode scan (or manual
barcode entry) replaces typing out a packaged product's ingredients.
"""
import json
import urllib.request
import urllib.error

API_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"
USER_AGENT = "exposure-awareness-tool/0.1 (educational, local single-user; contact: n/a)"


def lookup_barcode(barcode):
    """Returns {name, ingredients_text, nova_group, brands} or None if not found /
    the barcode isn't in Open Food Facts' database."""
    barcode = "".join(ch for ch in barcode if ch.isdigit())
    if not barcode:
        return None
    url = API_URL.format(barcode=barcode)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError):
        return None

    if data.get("status") != 1:
        return None
    product = data.get("product", {})
    name = product.get("product_name") or product.get("generic_name")
    if not name:
        return None
    return {
        "name": name,
        "brands": product.get("brands", ""),
        "ingredients_text": product.get("ingredients_text", ""),
        "nova_group": product.get("nova_group"),  # 1-4, or None if OFF hasn't computed it
    }


if __name__ == "__main__":
    import sys
    barcode = sys.argv[1] if len(sys.argv) > 1 else "3017620422003"
    print(json.dumps(lookup_barcode(barcode), indent=2))
