import os

# Must be set before Django/settings load so mongoengine connects to mongomock
os.environ.setdefault("MONGODB_URI", "mongomock://localhost")
os.environ.setdefault("MONGODB_DB_NAME", "bs_testdb")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("DEBUG", "True")

import pytest
import mongoengine


@pytest.fixture(autouse=True)
def isolate_db():
    """Drop every registered collection before each test for isolation."""
    yield
    for cls in list(mongoengine.base.common._document_registry.values()):
        try:
            cls.drop_collection()
        except Exception:
            pass
