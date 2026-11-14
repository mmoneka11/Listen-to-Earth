"""
Listen to Earth — FastAPI Canonical Entrypoint for Vercel / ASGI.
Exports the FastAPI `app` from `serve_features`.
"""
try:
    from serve_features import app
except ImportError:
    from backend.serve_features import app

__all__ = ["app"]
