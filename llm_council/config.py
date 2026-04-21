from .settings import DEFAULT_MODEL_MAP as MODEL_MAP
from .settings import PERSONA, get_settings

settings = get_settings()

USE_MOCK_MODE = settings.use_mock_mode
OPENROUTER_API_KEY = settings.openrouter_api_key
OPENROUTER_BASE_URL = settings.openrouter_base_url
OPENROUTER_SITE_URL = settings.openrouter_site_url
OPENROUTER_APP_NAME = settings.openrouter_app_name
