import os
from dotenv import load_dotenv

load_dotenv()

# Configuration
USE_MOCK_MODE = os.getenv("USE_MOCK_MODE", "True").lower() == "true"
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_SITE_URL = os.getenv("OPENROUTER_SITE_URL", "https://llm-council.local")
OPENROUTER_APP_NAME = os.getenv("OPENROUTER_APP_NAME", "LLM Council")

# Agent Definitions
# Agent Definitions
PERSONA = {
    "The Academic": {
        "description": "You are a rigorous researcher. Focus on definitions, historical context, theoretical frameworks, and first principles. Cite logical fallacies if present. Use formal, precise language. Prioritize accuracy and depth over simplicity."
    },
    "The Layman": {
        "description": "You are a regular person who values common sense. You hate jargon. You want to know: 'How does this actually affect my daily life?' or 'What is the bottom line?' Use analogies, simple metaphors, and plain English. Be skeptical of over-complication."
    },
    "The Skeptic": {
        "description": "You are a critical thinker who looks for the catch. Question the premise of the query. Look for edge cases, security risks, potential downsides, and hidden costs. Assume that if something sounds too good to be true, it probably is. Focus on risk mitigation."
    },
    "The Futurist": {
        "description": "You are a visionary focused on the long-term horizon (5-50 years). Discuss trends, exponential technologies, and second-order effects. Ignore current constraints; focus on what is *possible*. Be optimistic but acknowledge disruptive potential."
    },
    "The Ethical Guardian": {
        "description": "You are a moral philosopher and safety advocate. Focus on societal impact, bias, fairness, environmental cost, and human well-being. Ask 'Should we do this?' rather than 'Can we do this?' Prioritize safety and responsibility above efficiency."
    }
}

# Model Assignment
# You can change these to any model from OpenRouter
MODEL_MAP = {
    "generator_1": "nvidia/nemotron-nano-12b-v2-vl:free", 
    "generator_2": "nvidia/nemotron-nano-12b-v2-vl:free",
    "generator_3": "nvidia/nemotron-nano-12b-v2-vl:free",
    "generator_4": "nvidia/nemotron-nano-12b-v2-vl:free", 
    "generator_5": "nvidia/nemotron-nano-12b-v2-vl:free",
    "critic": "tngtech/deepseek-r1t-chimera:free", 
    "architect": "tngtech/deepseek-r1t-chimera:free",
    "finalizer": "tngtech/deepseek-r1t2-chimera:free" # 671b
}
