import os

os.environ.setdefault("MONGODB_URI", "mongodb://localhost")
os.environ.setdefault("MONGODB_DB_NAME", "bs_testdb")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("DEBUG", "True")

# Patch pymongo.MongoClient with mongomock *before* Django loads settings.py.
# mongoengine >= 0.27 removed mongomock:// URI support, so we patch at the
# pymongo level instead — any MongoClient call transparently gets an in-memory mock.
import mongomock
mongomock.patch().start()

import pytest
import mongoengine


@pytest.fixture(autouse=True)
def isolate_db():
    """Drop every registered collection after each test for isolation."""
    yield
    for cls in list(mongoengine.base.common._document_registry.values()):
        try:
            cls.drop_collection()
        except Exception:
            pass
