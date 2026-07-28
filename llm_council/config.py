from .settings import DEFAULT_MODEL_MAP as MODEL_MAP
from .settings import PERSONA, get_settings

settings = get_settings()

USE_MOCK_MODE = settings.use_mock_mode
NVIDIA_API_KEY = settings.nvidia_api_key
NVIDIA_API_BASE_URL = settings.nvidia_api_base_url
