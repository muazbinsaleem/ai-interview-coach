"""
app/utils/response.py
=====================
Standardised API response helpers.

Every endpoint must return one of two shapes:

  Success:  {"success": true,  "data": <any>}
  Error:    {"success": false, "message": "<human-readable string>"}

Functions:
  - success_response(data, status_code) → JSONResponse
  - error_response(message, status_code) → JSONResponse
"""

import logging
from typing import Any

from fastapi import status
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def success_response(
    data: Any,
    status_code: int = status.HTTP_200_OK,
) -> JSONResponse:
    """
    Build a standardised success response.

    Args:
        data:        The payload to embed under the ``data`` key.
                     Can be a dict, list, or any JSON-serialisable value.
        status_code: HTTP status code to send (default 200).

    Returns:
        A ``JSONResponse`` with body ``{"success": true, "data": data}``.
    """
    body = {"success": True, "data": data}
    logger.debug("success_response — status=%d", status_code)
    return JSONResponse(content=body, status_code=status_code)


def error_response(
    message: str,
    status_code: int = status.HTTP_400_BAD_REQUEST,
) -> JSONResponse:
    """
    Build a standardised error response.

    Args:
        message:     Human-readable error description.
        status_code: HTTP status code to send (default 400).

    Returns:
        A ``JSONResponse`` with body ``{"success": false, "message": message}``.
    """
    body = {"success": False, "message": message}
    logger.warning("error_response — status=%d — %s", status_code, message)
    return JSONResponse(content=body, status_code=status_code)
