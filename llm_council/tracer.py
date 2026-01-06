import os
import datetime
import json

class WorkflowTracer:
    def __init__(self, log_dir="logs"):
        """
        Initializes the WorkflowTracer with a unique log file.
        """
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filename = os.path.join(log_dir, f"trace_{timestamp}.md")
        self.file = open(self.filename, "w", encoding="utf-8")
        
        # Write Header
        self.file.write(f"# Flight Recorder Trace: {timestamp}\n\n")
        self.file.write("This file logs the entire lifecycle of the request.\n\n")
        self.file.flush()
        
    def log_step(self, phase_name: str, agent_tag: str, input_data: str, output_data: str):
        """
        Logs a single step in the workflow to the Markdown file.
        """
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")

        # --- REDACTION LOGIC ---
        # Mask OpenRouter API Keys (start with sk-or-v1-)
        # Also generic safety for "custom_api_key" if it appears in JSON string
        def redact(text: str) -> str:
            if not text: return text
            import re
            # Specific JSON field redaction
            text = re.sub(r'("custom_api_key"\s*:\s*")[^"]*(")', r'\1[REDACTED]\2', text)
            # General key heuristic (sk-or-v1-...)
            text = re.sub(r'(sk-or-v1-[a-zA-Z0-9]{32,})', r'[REDACTED_Key]', text)
            return text

        safe_input = redact(input_data)
        safe_output = redact(output_data)
        # ------------------------
        
        entry = (
            f"## Phase: {phase_name}\n"
            f"**Timestamp:** {timestamp}\n"
            f"**Agent:** {agent_tag}\n\n"
            f"### Inputs\n"
            f"```text\n{safe_input}\n```\n\n"
            f"### Outputs\n"
            f"```json\n{safe_output}\n```\n"
            f"---\n\n"
        )
        
        self.file.write(entry)
        self.file.flush()

    def finalize(self):
        """
        Closes the log file.
        """
        self.file.write("\n# End of Trace\n")
        self.file.close()
        return self.filename
