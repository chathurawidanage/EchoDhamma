import json
import os


class PromptService:
    def __init__(self):
        self.base_prompt_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "prompts", "base.md"
        )
        self.alignment_prompt_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            "prompts",
            "chapter_alignment.md",
        )
        # Load prompts into memory
        self.base_prompt = self._read_file(self.base_prompt_path)
        self.alignment_prompt = self._read_file(self.alignment_prompt_path)

    def _read_file(self, path):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
        return ""

    def get_base_prompt(self):
        return self.base_prompt

    def get_base_schema(self):
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
                "chapters": {
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
                },
            },
            "required": [
                "podcast_friendly",
                "title_components",
                "description",
                "chapters",
            ],
        }

        return schema

    def get_alignment_prompt(self, current_chapters):
        prompt_text = self.alignment_prompt
        # Inject chapters as JSON string
        chapters_json = json.dumps(current_chapters, indent=2, ensure_ascii=False)
        prompt_text = prompt_text.replace("{chapters}", chapters_json)
        return prompt_text

    def get_alignment_schema(self):
        schema = {
            "type": "object",
            "properties": {
                "chapters": {
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
            },
            "required": ["chapters"],
        }
        return schema


if __name__ == "__main__":
    from echodhamma.utils.logger import setup_logging

    setup_logging()
    service = PromptService()
    print(service.get_base_prompt(include_chapters=True))
