"""
Unit tests for pure service-layer functions.
No database or network calls required.
"""
import pytest
from users.services import normalize_group_label, slugify_group_label, _round_currency


class TestNormalizeGroupLabel:
    def test_none_returns_fallback(self):
        result = normalize_group_label(None)
        assert result == "Personal split"

    def test_empty_string_returns_fallback(self):
        assert normalize_group_label("") == "Personal split"

    def test_whitespace_only_returns_fallback(self):
        assert normalize_group_label("   ") == "Personal split"

    def test_valid_label_is_stripped(self):
        assert normalize_group_label("  Trip to Paris  ") == "Trip to Paris"

    def test_valid_label_preserved(self):
        assert normalize_group_label("Apartment") == "Apartment"

    def test_non_string_returns_fallback(self):
        assert normalize_group_label(42) == "Personal split"


class TestSlugifyGroupLabel:
    def test_lowercase_and_hyphenated(self):
        assert slugify_group_label("Trip to Paris") == "trip-to-paris"

    def test_extra_spaces_collapsed(self):
        assert slugify_group_label("  dinner   party  ") == "dinner-party"

    def test_special_chars_removed(self):
        slug = slugify_group_label("Café & Friends!")
        assert " " not in slug
        assert "&" not in slug

    def test_empty_string(self):
        result = slugify_group_label("")
        assert isinstance(result, str)

    def test_already_slug(self):
        assert slugify_group_label("apartment") == "apartment"


class TestRoundCurrency:
    def test_rounds_to_two_decimal_places(self):
        assert _round_currency(10.005) == 10.01

    def test_integer_input(self):
        assert _round_currency(5) == 5.0

    def test_zero(self):
        assert _round_currency(0) == 0.0

    def test_negative(self):
        assert _round_currency(-3.456) == pytest.approx(-3.46, abs=0.001)

    def test_string_input(self):
        assert _round_currency("12.999") == pytest.approx(13.0, abs=0.001)

    def test_none_returns_zero(self):
        assert _round_currency(None) == 0.0
