import json
import os


class PromptService:
    def __init__(self):
        self.base_prompt_path = os.path.join(
            os.path.dirname(__file__), "prompts", "base.md"
        )
        self.chapters_prompt_path = os.path.join(
            os.path.dirname(__file__), "prompts", "chapters.md"
        )
        self.source_material_prompt_path = os.path.join(
            os.path.dirname(__file__), "prompts", "source_material.md"
        )
        # Load prompts into memory
        self.base_prompt = self._read_file(self.base_prompt_path)
        self.chapters_prompt = self._read_file(self.chapters_prompt_path)
        self.source_material_prompt = self._read_file(self.source_material_prompt_path)

    def _read_file(self, path):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return ""

    def get_prompt(self, include_chapters=True):
        prompt_text = self.base_prompt

        # Add chapters prompt if requested
        chapters_content = ""
        source_material_content = ""

        if include_chapters:
            chapters_content = self.chapters_prompt
            source_material_content = self.source_material_prompt

        # Inject source material
        prompt_text = prompt_text.replace("{source_material}", source_material_content)

        # Inject chapters
        prompt_text = prompt_text.replace("{chapters}", chapters_content)

        # Build JSON Schema
        schema_json = self._build_schema(include_chapters)
        prompt_text += "\n# JSON Output Schema\n\n" + schema_json

        return prompt_text

    def _build_schema(self, include_chapters):
        schema = {
            "podcast_friendly": "boolean",
            "title_components": {
                "series_name": "string or null",
                "episode_number": "string or null",
                "topic_summary": "string",
            },
            "description": "HTML_CONTENT_HERE",
        }

        if include_chapters:
            schema["chapters"] = [
                {
                    "start_time": "string (HH:MM:SS)",
                    "title": "string",
                    "description": "string or null",
                    "isQ&A": "boolean",
                }
            ]

        return json.dumps(schema, indent=4)


if __name__ == "__main__":
    from logger import setup_logging

    setup_logging()
    service = PromptService()
    print(service.get_prompt(include_chapters=True))
