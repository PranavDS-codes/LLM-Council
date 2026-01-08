import asyncio
import os
import json
from tracer import WorkflowTracer
from llm_client import LLMClient
from config import PERSONA, MODEL_MAP
from schemas import CriticOutput, ArchitectBlueprint


# GET THE ABSOLUTE PATH OF THE DIRECTORY CONTAINING THIS SCRIPT
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_prompt(filename):
    # Construct path relative to this script's location
    # It will look in: /app/llm_council/prompts/filename
    filepath = os.path.join(BASE_DIR, "prompts", filename)
    
    try:
        with open(filepath, "r") as f:
            return f.read()
    except FileNotFoundError:
        # Fallback debug print to help if it fails again
        print(f"❌ Error: Could not find prompt at {filepath}")
        print(f"   Current Working Directory: {os.getcwd()}")
        raise

PROMPT_GENERATOR = load_prompt("1_generator.txt")
PROMPT_CRITIC = load_prompt("2_critic.txt")
PROMPT_ARCHITECT = load_prompt("3_architect.txt")
PROMPT_FINALIZER = load_prompt("4_finalizer.txt")

def format_responses_for_critic(responses: list) -> str:
    """
    Takes a list of response objects/dicts and formats them into a single string.
    Works for 1, 2, 3, or 100 responses.
    """
    output_text = ""
    for response in responses:
        # Assuming response object has 'persona' (mapped to agent_name) and 'content' attributes
        header = f"--- RESPONSE ID: {response['persona']} ---"
        body = response['content']
        output_text += f"{header}\n{body}\n\n"
    return output_text

import sys

async def main():
    # Initialization
    tracer = WorkflowTracer()
    client = LLMClient()
    
    # Get query from args or use default
    # Interactive Input Mode
    print("Welcome to LLM council")
    query = input("Query: ")
    print("Available Agents:")
    for i, persona in enumerate(PERSONA.keys()):
        print(f"{i+1}: {persona}")
    indices_input = input("Agents (e.g. 1,2,3): ")
    
    selected_indices = [1, 2, 3] # Default
    if indices_input.strip():
        try:
             # Handle comma or space separated
             cleaned_indices = indices_input.replace(",", " ")
             selected_indices = [int(x) for x in cleaned_indices.split()]
        except ValueError:
            print("Invalid format. Using default [1, 2, 3].")

    print("Working...")
    tracer.log_step("Initialization", "System", query, f"Workflow Started. Indices: {selected_indices}")

    # --- Phase 1: Generators ---
    print("\n--- Phase 1: Generators ---")
    generator_tasks = []
    
    # Get all available personas keys as a list for indexing (1-based for user)
    persona_keys = list(PERSONA.keys())
    
    for i, idx in enumerate(selected_indices):
        # Validate index
        if 1 <= idx <= len(persona_keys):
            persona_name = persona_keys[idx - 1]
            persona_desc = PERSONA[persona_name]["description"]
            
            prompt = PROMPT_GENERATOR.format(
                persona_name=persona_name, 
                persona_instruction=persona_desc, 
                query=query
            )
            
            # Map index in the *loop* to a generator model slot (generator_1, generator_2...)
            # We treat the Nth generator instantiated as "generator_N"
            model_key = f"generator_{i+1}"
            model_id = MODEL_MAP.get(model_key, MODEL_MAP.get("generator_1"))
            
            print(f"Spawning Generator {i+1}: {persona_name} (Model: {model_id})")
            task = asyncio.create_task(client.generate(prompt, model=model_id))
            generator_tasks.append((persona_name, task))
        else:
            print(f"Warning: Index {idx} out of range (1-{len(persona_keys)}). Skipping.")
    
    responses = []
    for persona, task in generator_tasks:
        response, usage = await task
        print(f"[{persona}] Generated response. Tokens: {usage['total']}")
        tracer.log_step("Generators", f"Generator-{persona}", query, response)
        responses.append({"persona": persona, "content": response})

    # --- Phase 2: Critics ---
    print("\n--- Phase 2: Critics ---")
    
    # Group responses into batches of 3
    # If we have [A, B, C, D, E], chunks are [A, B, C], [D, E]
    
    chunk_size = 3
    critique_results = []
    
    for i in range(0, len(responses), chunk_size):
        chunk = responses[i:i + chunk_size]
        if not chunk: continue
        
        # 1. Format dynamically using helper
        formatted_text = format_responses_for_critic(chunk)
        
        # 2. Inject into prompt
        prompt = PROMPT_CRITIC.format(
            query=query,
            formatted_responses=formatted_text
        )
        
        print(f"Running Critic on batch {i//chunk_size + 1}...")
        critic_response_json, c_usage = await client.generate(prompt, schema=CriticOutput, model=MODEL_MAP["critic"])
        tracer.log_step("Critics", f"Critic-Judge-Batch-{i//chunk_size + 1}", prompt, critic_response_json)
        
        try:
            critic_data = json.loads(critic_response_json)
            # Find winner content
            winner_id = critic_data.get('winner_id', '')
            
            # Match winner ID to content in chunk
            batch_winner_content = chunk[0]['content'] # Default
            
            # Try to partial match the persona name in the winner_id
            found = False
            for resp in chunk:
                if resp['persona'] in winner_id:
                     batch_winner_content = resp['content']
                     found = True
                     break
            
            # Store the winner info and the critique data
            critique_results.append({
                "winner_content": batch_winner_content,
                "winner_id": winner_id,
                "data": critic_data
            })
            print(f"[Critic] Batch Winner: {winner_id}. Usage: {c_usage['total']}")

        except Exception as e:
            print(f"Error parsing critic JSON: {e}")
            if chunk:
                critique_results.append({
                    "winner_content": chunk[0]['content'],
                    "winner_id": "Default (First in Batch)",
                    "data": {"error": "Failed parse"}
                })

    # Select overall best (for Architect)
    # If multiple batches, we have multiple winners. 
    # For now, let's take the first batch's winner or the one with highest score if available.
    if critique_results:
        # Just taking the first one for simplicity as "Best Response" to pass to architect
        # Or we could concatenate them? User prompt expects "Best Draft Response".
        best_response_content = critique_results[0]['winner_content']
        combined_critiques = json.dumps([c['data'] for c in critique_results])
    else:
        best_response_content = "No valid responses."
        combined_critiques = "[]"

    # --- Phase 3: Architect ---
    print("\n--- Phase 3: Architect ---")
    prompt = PROMPT_ARCHITECT.format(
        query=query,
        best_response=best_response_content,
        critiques=combined_critiques
    )
    blueprint_json, a_usage = await client.generate(prompt, schema=ArchitectBlueprint, model=MODEL_MAP["architect"])
    print("[Architect] Blueprint created. Model used {}. Usage: {}".format(MODEL_MAP["architect"], a_usage['total']))
    tracer.log_step("Architect", "Architect-Planner", prompt, blueprint_json)

    # --- Phase 4: Finalizer ---
    print("\n--- Phase 4: Finalizer ---")
    prompt = PROMPT_FINALIZER.format(
        query=query,
        blueprint=blueprint_json,
        context=best_response_content
    )
    final_output, f_usage = await client.generate(prompt, model=MODEL_MAP["finalizer"])
    print("[Finalizer] Final answer generated. Model used {}. Usage: {}".format(MODEL_MAP["finalizer"], f_usage['total']))
    print("FINAL OUTPUT")
    print(final_output)
    tracer.log_step("Finalizer", "Finalizer-Writer", prompt, final_output)

    # Completion
    log_path = tracer.finalize()
    print(f"\nSUCCESS. Full trace saved to: {log_path}")
    print("Run `cat " + log_path + "` to inspect the flight recorder log.")

if __name__ == "__main__":
    asyncio.run(main())
