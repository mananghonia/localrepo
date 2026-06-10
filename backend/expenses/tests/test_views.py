"""
API validation tests for expense endpoints.
Uses DRF's APIRequestFactory with a mock authenticated user.
"""
import json
import sys
import pytest
from unittest.mock import MagicMock, patch
from rest_framework.test import APIRequestFactory

from expenses.views import ExpenseListCreateView, ScanReceiptView

FAKE_OID = "507f1f77bcf86cd799439011"  # valid 24-char hex ObjectId (does not exist in DB)


def _make_user(user_id="user123", name="Test User"):
    user = MagicMock()
    user.id = user_id
    user.name = name
    user.email = "test@example.com"
    user.username = "testuser"
    return user


def _post(view_class, data, user=None):
    factory = APIRequestFactory()
    raw = factory.post("/", data=json.dumps(data), content_type="application/json")
    # _force_auth_user makes DRF skip authenticators and use this user directly
    raw._force_auth_user = user or _make_user()
    view = view_class.as_view()
    return view(raw)


def _mock_anthropic_module(response_text):
    """Return a sys.modules patch so `import anthropic` inside the view returns a mock."""
    mock_module = MagicMock()
    mock_client = MagicMock()
    mock_module.Anthropic.return_value = mock_client
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text=response_text)]
    )
    return patch.dict(sys.modules, {"anthropic": mock_module})


class TestExpenseCreateValidation:
    def test_missing_note_no_crash(self):
        """Expense with no note and a nonexistent participant returns a non-201 error."""
        response = _post(
            ExpenseListCreateView,
            {"total_amount": 10.00, "participants": [{"user_id": FAKE_OID, "amount": 10.0}]},
        )
        # User doesn't exist → 404; empty note → 400. Either way, not a success.
        assert response.status_code in (400, 404)

    def test_zero_total_returns_400(self):
        response = _post(
            ExpenseListCreateView,
            {"note": "Dinner", "total_amount": 0, "participants": []},
        )
        assert response.status_code == 400

    def test_negative_total_returns_400(self):
        response = _post(
            ExpenseListCreateView,
            {"note": "Dinner", "total_amount": -5.0, "participants": []},
        )
        assert response.status_code == 400

    def test_non_numeric_total_returns_400(self):
        response = _post(
            ExpenseListCreateView,
            {"note": "Lunch", "total_amount": "abc", "participants": []},
        )
        assert response.status_code == 400

    def test_empty_participants_returns_400(self):
        response = _post(
            ExpenseListCreateView,
            {"note": "Lunch", "total_amount": 20.0, "participants": []},
        )
        assert response.status_code == 400

    def test_missing_user_id_in_participant_returns_400(self):
        response = _post(
            ExpenseListCreateView,
            {
                "note": "Lunch",
                "total_amount": 20.0,
                "participants": [{"amount": 20.0}],  # no user_id
            },
        )
        assert response.status_code == 400

    def test_negative_participant_amount_returns_400(self):
        response = _post(
            ExpenseListCreateView,
            {
                "note": "Lunch",
                "total_amount": 20.0,
                "participants": [{"user_id": FAKE_OID, "amount": -5.0}],
            },
        )
        assert response.status_code == 400


class TestScanReceiptValidation:
    @pytest.fixture(autouse=True)
    def require_api_key(self, settings):
        """Ensure ANTHROPIC_API_KEY is set for every test in this class."""
        settings.ANTHROPIC_API_KEY = "test-key"

    def test_no_image_returns_400(self):
        response = _post(ScanReceiptView, {})
        assert response.status_code == 400
        assert "image" in response.data.get("error", "").lower()

    def test_oversized_image_returns_400(self):
        big_b64 = "A" * 11_000_000
        response = _post(ScanReceiptView, {"image": big_b64, "mime_type": "image/jpeg"})
        assert response.status_code == 400
        assert "large" in response.data.get("error", "").lower()

    def test_missing_api_key_returns_503(self, settings):
        settings.ANTHROPIC_API_KEY = ""
        response = _post(ScanReceiptView, {"image": "dGVzdA==", "mime_type": "image/jpeg"})
        assert response.status_code == 503

    def test_invalid_mime_type_falls_back_to_jpeg(self):
        """Unsupported MIME type should not raise — it falls back to image/jpeg."""
        with _mock_anthropic_module('{"note": "Starbucks", "total_amount": 5.75}'):
            response = _post(
                ScanReceiptView,
                {"image": "dGVzdA==", "mime_type": "image/bmp"},  # unsupported
            )
        assert response.status_code == 200

    def test_successful_scan_returns_note_and_total(self):
        with _mock_anthropic_module('{"note": "Chipotle", "total_amount": 12.85}'):
            response = _post(
                ScanReceiptView,
                {"image": "dGVzdA==", "mime_type": "image/jpeg"},
            )
        assert response.status_code == 200
        assert response.data["note"] == "Chipotle"
        assert response.data["total_amount"] == 12.85

    def test_malformed_json_from_ai_returns_422(self):
        with _mock_anthropic_module("Sorry, I cannot read this receipt."):
            response = _post(
                ScanReceiptView,
                {"image": "dGVzdA==", "mime_type": "image/jpeg"},
            )
        assert response.status_code == 422
