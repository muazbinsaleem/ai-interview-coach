"""
app/models/user.py
==================
Pydantic v2 schemas for the User domain.

Schemas:
  - SignupRequest   — body for POST /auth/signup
  - LoginRequest    — body for POST /auth/login
  - UserPublic      — safe user representation returned to the client
  - UserInDB        — internal representation including password_hash
  - AuthResponse    — wraps token + user returned after login / signup
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    """Request body for POST /auth/signup."""

    name: str = Field(..., min_length=1, max_length=255, description="Full name")
    email: EmailStr = Field(..., description="Unique email address")
    password: str = Field(..., min_length=6, description="Plain-text password (min 6 chars)")


class LoginRequest(BaseModel):
    """Request body for POST /auth/login."""

    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Plain-text password")


class UserPublic(BaseModel):
    """Safe user representation — never includes the password hash."""

    id: UUID
    name: str
    email: EmailStr
    created_at: Optional[datetime] = None


class UserInDB(BaseModel):
    """
    Internal representation of a user row from Supabase.

    This schema is only used inside services; it must never be returned
    directly to the client because it contains the password hash.
    """

    id: UUID
    name: str
    email: EmailStr
    password_hash: str
    created_at: Optional[datetime] = None


class AuthResponse(BaseModel):
    """Payload nested under 'data' after a successful signup or login."""

    token: str = Field(..., description="Signed JWT access token")
    user: UserPublic
