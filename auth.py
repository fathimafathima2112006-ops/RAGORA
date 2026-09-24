"""Authentication helpers for RAGORA.

Passwords are stored as salted PBKDF2-HMAC-SHA256 hashes in SQLite.
"""
from db import create_user, authenticate_user

__all__ = ["create_user", "authenticate_user"]
