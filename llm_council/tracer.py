import os
import datetime
import json

class WorkflowTracer:
    def __init__(self, log_dir="llm_council/logs"):
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
        
        entry = (
            f"## Phase: {phase_name}\n"
            f"**Timestamp:** {timestamp}\n"
            f"**Agent:** {agent_tag}\n\n"
            f"### Inputs\n"
            f"```text\n{input_data}\n```\n\n"
            f"### Outputs\n"
            f"```json\n{output_data}\n```\n"
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
