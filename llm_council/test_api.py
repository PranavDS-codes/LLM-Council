import asyncio
import os
from llm_client import LLMClient
from config import MODEL_MAP

async def test_connection():
    print("--- API Connection Test for All Agents ---")
    
    # Check Environment
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print("[ERROR] OPENROUTER_API_KEY not found in environment variables.")
        return
    else:
        print(f"[INFO] API Key found: {api_key[:5]}...{api_key[-4:]}")

    client = LLMClient()
    print(f"[INFO] Mock Mode: {client.mock_mode}")
    
    # Iterate over all defined agents and their models
    for agent_role, model_id in MODEL_MAP.items():
        # Only check generator_1 to save time/credits, assuming others share the model
        if agent_role.startswith("generator") and agent_role != "generator_1":
            continue
        try:
            print("Sleeping to respect rate limits...")
            await asyncio.sleep(2)
            prompt = f"Hello {agent_role}, are you online? Reply with a very simple 'Yes' within 10 words."
            response = await client.generate(prompt, model=model_id)
            print(f"[SUCCESS] {agent_role} Response received:\n{response}")
        except Exception as e:
            print(f"[FAILURE] Error calling model {model_id}: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
