"""
app/database.py
===============
Creates and exports a single Supabase client instance.

Import `supabase` from this module wherever you need to interact with the
database.  The client is created once when this module is first imported,
so there is no per-request overhead.
"""

import logging
from supabase import create_client, Client
from app.config import settings

logger = logging.getLogger(__name__)

supabase: Client = create_client(settings.supabase_url, settings.supabase_key)

logger.info("Supabase client initialised — url=%s", settings.supabase_url)
