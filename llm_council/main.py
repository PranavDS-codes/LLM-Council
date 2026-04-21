from __future__ import annotations

import asyncio
import json

from .settings import PERSONA
from .workflow import CouncilWorkflow, WorkflowRequest


async def main() -> None:
    council = CouncilWorkflow()

    print("Welcome to LLM Council")
    query = input("Query: ").strip()
    print("Available Agents:")
    persona_names = list(PERSONA.keys())
    for index, persona in enumerate(persona_names, start=1):
        print(f"{index}: {persona}")

    indices_input = input("Agents (e.g. 1,2,3): ").strip()
    selected_indices = [1, 2, 3]
    if indices_input:
        try:
            selected_indices = [int(value) for value in indices_input.replace(",", " ").split()]
        except ValueError:
            print("Invalid format. Using default [1, 2, 3].")

    selected_agents = [
        persona_names[index - 1]
        for index in selected_indices
        if 1 <= index <= len(persona_names)
    ]

    print("Working...")
    async for event in council.stream(WorkflowRequest(query=query, selected_agents=selected_agents)):
        event_type = event["type"]
        if event_type == "generator_start":
            print(f"Spawning {event['agent']} ({event['model']})")
        elif event_type == "generator_done":
            print(f"[{event['agent']}] done in {event['time_taken']:.2f}s / {event['usage']['total']} tokens")
        elif event_type == "critic_result":
            print(f"[Critic] Winner: {event['winner_id']}")
        elif event_type == "architect_result":
            print("[Architect] Blueprint ready")
            print(json.dumps(event, indent=2))
        elif event_type == "finalizer_chunk":
            print(event["chunk"], end="", flush=True)
        elif event_type == "finalizer_done":
            print(f"\n[Finalizer] done in {event['time_taken']:.2f}s")
        elif event_type == "error":
            print(f"\n[Warning] {event['message']}")
        elif event_type == "done":
            print(
                f"\nSUCCESS. Total time: {event['total_execution_time']:.2f}s. "
                f"Total tokens: {event['total_tokens']['total']}"
            )


def cli() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    cli()
