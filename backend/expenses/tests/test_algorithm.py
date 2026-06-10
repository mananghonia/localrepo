"""
Tests for the _min_cash_flow debt-simplification algorithm.
Pure Python — no database or authentication needed.
"""
import pytest
from expenses.views import _min_cash_flow


def _total_transferred(txns):
    return round(sum(t["amount"] for t in txns), 2)


def _all_settled(people, txns):
    """Return True if applying txns would leave everyone at net 0."""
    net = {p["name"]: p["net"] for p in people}
    for t in txns:
        net[t["from_name"]] += t["amount"]   # debtor pays → debt reduced
        net[t["to_name"]] -= t["amount"]     # creditor receives → owed amount reduced
    return all(abs(v) < 0.01 for v in net.values())


class TestMinCashFlowBasic:
    def test_all_settled_returns_empty(self):
        people = [
            {"id": "1", "name": "Alice", "net": 0.0},
            {"id": "2", "name": "Bob", "net": 0.0},
        ]
        assert _min_cash_flow(people) == []

    def test_single_debt(self):
        people = [
            {"id": "1", "name": "Alice", "net": 10.0},
            {"id": "2", "name": "Bob", "net": -10.0},
        ]
        txns = _min_cash_flow(people)
        assert len(txns) == 1
        assert txns[0] == {"from_name": "Bob", "to_name": "Alice", "amount": 10.0}

    def test_single_debt_fractional(self):
        people = [
            {"id": "1", "name": "Alice", "net": 12.50},
            {"id": "2", "name": "Bob", "net": -12.50},
        ]
        txns = _min_cash_flow(people)
        assert txns[0]["amount"] == 12.50

    def test_chain_simplification(self):
        """A owes B $10, B owes C $10 → should simplify to one payment: A pays C $10."""
        people = [
            {"id": "1", "name": "A", "net": -10.0},
            {"id": "2", "name": "B", "net": 0.0},
            {"id": "3", "name": "C", "net": 10.0},
        ]
        txns = _min_cash_flow(people)
        assert len(txns) == 1
        assert txns[0]["from_name"] == "A"
        assert txns[0]["to_name"] == "C"
        assert txns[0]["amount"] == 10.0

    def test_one_creditor_multiple_debtors(self):
        people = [
            {"id": "1", "name": "Alice", "net": 20.0},
            {"id": "2", "name": "Bob", "net": -8.0},
            {"id": "3", "name": "Charlie", "net": -12.0},
        ]
        txns = _min_cash_flow(people)
        assert _total_transferred(txns) == 20.0
        assert all(t["to_name"] == "Alice" for t in txns)
        assert _all_settled(people, txns)

    def test_multiple_creditors_multiple_debtors(self):
        people = [
            {"id": "1", "name": "Alice", "net": 15.0},
            {"id": "2", "name": "Bob", "net": 5.0},
            {"id": "3", "name": "Charlie", "net": -10.0},
            {"id": "4", "name": "Dave", "net": -10.0},
        ]
        txns = _min_cash_flow(people)
        assert _all_settled(people, txns)
        # Optimal is ≤ (n-1) transactions
        assert len(txns) <= 3

    def test_empty_people_list(self):
        assert _min_cash_flow([]) == []

    def test_tiny_amounts_ignored(self):
        """Balances under 0.01 are treated as settled."""
        people = [
            {"id": "1", "name": "Alice", "net": 0.001},
            {"id": "2", "name": "Bob", "net": -0.001},
        ]
        assert _min_cash_flow(people) == []


class TestMinCashFlowSettlement:
    def test_result_fully_settles_debts(self):
        """Property test: applying the returned transactions leaves everyone at net 0."""
        people = [
            {"id": "1", "name": "Alice", "net": 30.0},
            {"id": "2", "name": "Bob", "net": -15.0},
            {"id": "3", "name": "Carol", "net": -10.0},
            {"id": "4", "name": "Dave", "net": -5.0},
        ]
        txns = _min_cash_flow(people)
        assert _all_settled(people, txns)

    def test_transaction_count_is_minimal(self):
        """With n people at most n-1 transactions are needed."""
        people = [
            {"id": str(i), "name": f"P{i}", "net": float(10 - i * 4)}
            for i in range(6)
        ]
        txns = _min_cash_flow(people)
        assert _all_settled(people, txns)
        assert len(txns) <= len(people) - 1

    def test_amounts_are_positive(self):
        people = [
            {"id": "1", "name": "Alice", "net": 50.0},
            {"id": "2", "name": "Bob", "net": -25.0},
            {"id": "3", "name": "Carol", "net": -25.0},
        ]
        txns = _min_cash_flow(people)
        assert all(t["amount"] > 0 for t in txns)
