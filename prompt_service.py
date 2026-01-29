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

    def get_response_schema(self, include_chapters=True):
        schema = {
            "type": "object",
            "properties": {
                "podcast_friendly": {"type": "boolean"},
                "title_components": {
                    "type": "object",
                    "properties": {
                        "series_name": {"type": "string", "nullable": True},
                        "episode_number": {"type": "string", "nullable": True},
                        "topic_summary": {"type": "string"},
                    },
                    "required": ["series_name", "episode_number", "topic_summary"],
                },
                "description": {"type": "string"},
            },
            "required": ["podcast_friendly", "title_components", "description"],
        }

        if include_chapters:
            schema["properties"]["chapters"] = {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "start_time": {"type": "string"},
                        "title": {"type": "string"},
                        "description": {"type": "string", "nullable": True},
                        "isQ&A": {"type": "boolean"},
                    },
                    "required": ["start_time", "title", "description", "isQ&A"],
                },
            }
            schema["required"].append("chapters")

        return schema

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
