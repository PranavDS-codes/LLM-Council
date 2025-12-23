import os
import json
import asyncio
import random
from typing import List, Dict, Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from llm_client import LLMClient
from tracer import WorkflowTracer
from config import PERSONA, MODEL_MAP, USE_MOCK_MODE
from schemas import CriticOutput, ArchitectBlueprint

# Initialize App
app = FastAPI(title="LLM Council API")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development convenience
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Absolute Path Setup for Prompts
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROMPTS_DIR = os.path.join(BASE_DIR, "prompts")

def load_prompt(filename: str) -> str:
    path = os.path.join(PROMPTS_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Prompt file not found at: {path}")
    with open(path, "r") as f:
        return f.read()

# Load Prompts
try:
    PROMPT_GENERATOR = load_prompt("1_generator.txt")
    PROMPT_CRITIC = load_prompt("2_critic.txt")
    PROMPT_ARCHITECT = load_prompt("3_architect.txt")
    PROMPT_FINALIZER = load_prompt("4_finalizer.txt")
except Exception as e:
    print(f"CRITICAL ERROR loading prompts: {e}")
    # Fallbacks or re-raise depending on strictness. 
    # For now, we'll let it crash if prompts are missing as they are essential.
    raise e

class SummonRequest(BaseModel):
    query: str
    selected_agents: List[str]

    class Config:
        json_schema_extra = {
            "example": {
                "query": "Should we ban AI?",
                "selected_agents": ["The Academic", "The Ethical Guardian"]
            }
        }

def format_sse(event_type: str, data: Any) -> str:
    """Helper to format SSE messages."""
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"

# --- MOCK GENERATOR ---
async def mock_stream_generator(selected_agents: List[str]):
    """Simulates the full pipeline with dummy delays and data."""
    
    # Phase 1: Generators
    for agent in selected_agents:
        yield format_sse("generator_start", {"agent": agent})
        await asyncio.sleep(0.5)
        
        dummy_text = f"This is a mock response from {agent}. Checking different perspectives..."
        words = dummy_text.split()
        for i in range(0, len(words), 2):
            chunk = " ".join(words[i:i+2]) + " "
            yield format_sse("generator_chunk", {"agent": agent, "chunk": chunk})
            await asyncio.sleep(0.1)
            
    # Phase 2: Critic (Skipped if only 1 agent usually, but we'll specificy logic later)
    await asyncio.sleep(1)
    critic_result = {
        "winner_id": selected_agents[0] if selected_agents else "None",
        "rankings": selected_agents,
        "reasoning": "This agent provided the most balanced view in this mock scenario.",
        "scores": {agent: random.randint(5, 10) for agent in selected_agents},
        "flaws": {agent: "Mock criticism: Argument lacks specific examples." for agent in selected_agents}
    }
    yield format_sse("critic_result", critic_result)
    
    # Phase 3: Architect
    await asyncio.sleep(1)
    architect_result = {
        "structure": ["Introduction", "Analysis of Risks", "Strategic Benefits", "Conclusion"],
        "missing_facts_to_add": ["Recent regulatory changes", "Economic impact stats"],
        "tone_guidelines": "Balanced but authoritative"
    }
    yield format_sse("architect_result", architect_result)
    
    # Phase 4: Finalizer
    await asyncio.sleep(1)
    final_text = "Here is the final consolidated mockery of the council's decision.\n\n# Verdict\nBased on the input..."
    words = final_text.split()
    for word in words:
        yield format_sse("finalizer_chunk", {"chunk": word + " "})
        await asyncio.sleep(0.05)

# --- REAL GENERATOR ---
def format_responses_for_critic(responses: List[Dict]) -> str:
    output_text = ""
    for response in responses:
        header = f"--- RESPONSE ID: {response['persona']} ---"
        body = response['content']
        output_text += f"{header}\n{body}\n\n"
    return output_text

async def real_stream_generator(query: str, selected_agents: List[str]):
    # Initialize Tracer
    tracer = WorkflowTracer()
    client = LLMClient()
    
    # Log Start
    tracer.log_step("Initialization", "System", query, f"Workflow Started via API. Agents: {selected_agents}")

    # --- Phase 1: Generators ---
    generator_tasks = []
    persona_keys = list(PERSONA.keys())
    
    # Filter only valid selected agents
    active_agents = [a for a in selected_agents if a in PERSONA]
    
    if not active_agents:
         yield format_sse("error", {"message": "No valid agents selected."})
         return

    # Start all generators
    # We yield "start" events immediately
    for i, agent_name in enumerate(active_agents):
        yield format_sse("generator_start", {"agent": agent_name})
        
        persona_desc = PERSONA[agent_name]["description"]
        prompt = PROMPT_GENERATOR.format(
            persona_name=agent_name, 
            persona_instruction=persona_desc, 
            query=query
        )
        
        # Determine model
        # We try to map consistent model slots. 
        # If we have agents [A, B], we can use generator_1, generator_2
        model_key = f"generator_{i+1}" 
        model_id = MODEL_MAP.get(model_key, MODEL_MAP.get("generator_1"))
        
        # Launch task
        task = asyncio.create_task(client.generate(prompt, model=model_id))
        generator_tasks.append((agent_name, task))

    responses = []
    
    # Await them. Note: This implementation waits for ALL to finish before streaming chunks?
    # The requirement says "As the backend streams, the active tab should type out...".
    # But basic implementation usually awaits full response. 
    # To truly stream EACH agent in parallel is complex with a single SSE stream unless we multiplex.
    # For MVP: We will await the FULL response of an agent, then stream it out quickly as a "chunk" or simulates streaming?
    # OR better: The LLMClient.generate returns a string (not a stream). 
    # So we have to wait for the full string.
    # To simulate "streaming" to the UI, we can yield the full text or break it up.
    # Yielding the full text as one chunk is fine for V1, but "Type out response in real time" suggests token streaming.
    # Since LLMClient.generate is NOT streaming in the current codebase (it returns `await ...message.content`), 
    # we cannot do true real-time token streaming from the LLM without refactoring `llm_client.py`.
    # I will stick to "Wait for completion -> Stream result in chunks" to simulate the effect for now, 
    # unless I am allowed to refactor LLMClient. 
    # I'll stick to non-streaming LLM calls but streaming SSE to frontend.
    
    for agent_name, task in generator_tasks:
        response_content = await task
        # Log Generator Response
        tracer.log_step("Generators", f"Generator-{agent_name}", query, response_content)
        
        # Simulate streaming chunks to frontend so it looks alive
        # (or just send one big chunk if the UI helps)
        # Let's send 1 chunk for now for efficiency, or split by lines.
        yield format_sse("generator_chunk", {"agent": agent_name, "chunk": response_content})
        responses.append({"persona": agent_name, "content": response_content})

    # --- Phase 2: Critics ---
    # Only run if > 1 agent or if we want critique on single agent (self-reflection?)
    # Validating requirement: "If only 1 agent is selected, skip the 'Critic' phase"
    
    critique_results = []
    best_response_content = ""
    
    if len(active_agents) > 1:
        # Batching logic (simplified for < 5 agents usually)
        chunk_size = 3
        formatting_full_text = format_responses_for_critic(responses)
        tracer.log_step("Critics", "System", "Batching Responses", formatting_full_text) # Log the input to critics
        
        # We'll just do one big critique for all if < 5, or stick to the batch logic
        # Implementation from main.py assumes batching.
        
        # Create batches
        batches = [responses[i:i + chunk_size] for i in range(0, len(responses), chunk_size)]
        
        for idx, batch in enumerate(batches):
            formatted_text = format_responses_for_critic(batch)
            prompt = PROMPT_CRITIC.format(query=query, formatted_responses=formatted_text)
            
            try:
                critic_json_str = await client.generate(prompt, schema=CriticOutput, model=MODEL_MAP["critic"])
                critic_data = json.loads(critic_json_str)
                
                # Log Critic Result
                tracer.log_step("Critics", f"Critic-Batch-{idx+1}", prompt, critic_json_str)
                
                # Identify winner stuff
                winner_id = critic_data.get('winner_id', '')
                yield format_sse("critic_result", critic_data) # Send full data to frontend
                
                # Determine content for architect
                # Naive matching of winner_id to content
                batch_winner_content = batch[0]['content'] # Fallback
                for resp in batch:
                    if resp['persona'] in winner_id:
                        batch_winner_content = resp['content']
                        break
                
                critique_results.append(critic_data)
                best_response_content = batch_winner_content # Last batch winner becomes "best" for now
                
            except Exception as e:
                print(f"Critic Error: {e}")
                # Use first as fallback
                best_response_content = batch[0]['content']

    else:
        # Skip critic
        # We still need a "best response" for the Architect
        if responses:
            best_response_content = responses[0]['content']
            # Send a dummy critic result saying "Skipped" or just nothing?
            # User requirement: "auto-win that agent"
            auto_win = {
                "winner_id": active_agents[0],
                "rankings": active_agents,
                "reasoning": "Solo execution - automatic winner.",
                "scores": {active_agents[0]: 10},
                "flaws": {active_agents[0]: "N/A"}
            }
            tracer.log_step("Critics", "Auto-Critic", "Single Agent", json.dumps(auto_win))
            yield format_sse("critic_result", auto_win)

    # --- Phase 3: Architect ---
    # Needs critique data
    combined_critiques = json.dumps(critique_results) if critique_results else "[]"
    
    prompt_arch = PROMPT_ARCHITECT.format(
        query=query,
        best_response=best_response_content,
        critiques=combined_critiques
    )
    
    arch_json_str = await client.generate(prompt_arch, schema=ArchitectBlueprint, model=MODEL_MAP["architect"])
    
    # Log Architect
    tracer.log_step("Architect", "Architect-Planner", prompt_arch, arch_json_str)

    try:
        arch_data = json.loads(arch_json_str)
        yield format_sse("architect_result", arch_data)
    except:
        # Fallback if parsing fails
        yield format_sse("architect_result", {"structure": ["Error parsing architect"], "tone_guidelines": "N/A"})

    # --- Phase 4: Finalizer ---
    prompt_final = PROMPT_FINALIZER.format(
        query=query,
        blueprint=arch_json_str, # Passing the raw string or json? prompt expects json string likely
        context=best_response_content
    )
    
    final_output = await client.generate(prompt_final, model=MODEL_MAP["finalizer"])
    
    # Log Finalizer
    tracer.log_step("Finalizer", "Finalizer-Writer", prompt_final, final_output)
    
    # Stream the final output
    # Again, since client is not streaming, we simulate
    chunk_size = 50
    for i in range(0, len(final_output), chunk_size):
        chunk = final_output[i:i+chunk_size]
        yield format_sse("finalizer_chunk", {"chunk": chunk})
        await asyncio.sleep(0.01)

    tracer.finalize()
    yield format_sse("done", {})

@app.post("/api/summon")
async def summon(request: SummonRequest):
    if USE_MOCK_MODE:
        return StreamingResponse(mock_stream_generator(request.selected_agents), media_type="text/event-stream")
    else:
        return StreamingResponse(real_stream_generator(request.query, request.selected_agents), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
