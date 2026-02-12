import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv
import logging
from echodhamma.services.prompt_service import PromptService

logger = logging.getLogger(__name__)

load_dotenv()


class AIGenerationError(Exception):
    """Base class for AI generation errors."""

    pass


class AIRateLimitError(AIGenerationError):
    """Raised when AI rate limit is reached."""

    pass


class AIManager:
    def __init__(self, s3_manager=None):
        self.s3_manager = s3_manager
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not found in environment variables.")

        # Initialize the new GenAI client
        self.client = genai.Client(api_key=api_key)

        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

        # Initialize Prompt Service

        self.prompt_service = PromptService()

    def generate_metadata(self, video_url):
        """
        Calls Gemini to generate metadata using PromptService.

        Args:
            video_url (str): The YouTube video URL.
            transcript_path (str, optional): Local path to the transcript file.
        """
        # Get the prompt from the service
        prompt_text = self.prompt_service.get_base_prompt()

        try:
            # Construct content with video file data and prompt text as separate parts
            content = types.Content(
                parts=[
                    types.Part(
                        file_data=types.FileData(file_uri=video_url),
                        video_metadata=types.VideoMetadata(fps=0.1),
                    ),
                    types.Part(text=prompt_text),
                ]
            )

            # Retrieve schema to enforce strict JSON output
            schema = self.prompt_service.get_base_schema()

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=content,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.0,
                ),
            )

            if response and response.text:
                content = response.text.strip()
                return self._clean_and_parse_json(content)

        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "rate limit" in err_msg:
                raise AIRateLimitError(f"AI Rate limit reached: {e}")
            raise AIGenerationError(f"AI Generation failed: {e}")

        return None

    def get_cached_response(self, video_id):
        """Retrieves cached AI response from S3 if available."""
        if not self.s3_manager:
            return None

        key = f"ai_cache/{video_id}.json"
        logger.debug(f"Checking AI cache for {video_id}...")
        return self.s3_manager.get_json(key)

    def align_chapters(self, video_url, chapters, transcript_path):
        """
        Aligns chapter timestamps using the transcript.

        Args:
            video_url (str): The video URL (for logging/identification).
            chapters (list): List of existing chapter dicts.
            transcript_path (str): Path to the transcript file.

        Returns:
            list: List of chapters with corrected timestamps.
        """
        if not transcript_path or not os.path.exists(transcript_path):
            raise AIGenerationError("Transcript file not found for alignment.")

        # Get prompt
        prompt_text = self.prompt_service.get_alignment_prompt(chapters)

        try:
            # Upload transcript file
            logger.info(f"Uploading transcript to Gemini from {transcript_path}...")
            transcript_file = self.client.files.upload(file=transcript_path)
            logger.debug(f"Using transcript URI: {transcript_file.uri}")

            # Construct content with transcript file and prompt text
            parts = [
                types.Part(file_data=types.FileData(file_uri=transcript_file.uri)),
                types.Part(text=prompt_text),
            ]
            content = types.Content(parts=parts)

            # Get schema
            schema = self.prompt_service.get_alignment_schema()

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=content,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=schema,
                    temperature=0.0,
                ),
            )

            if response and response.text:
                content = response.text.strip()
                try:
                    result = self._clean_and_parse_json(content)
                    return result.get("chapters")

                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse alignment JSON: {e}")
                    raise AIGenerationError(f"Invalid JSON from alignment: {e}")

        except Exception as e:
            err_msg = str(e).lower()
            if "429" in err_msg or "rate limit" in err_msg:
                raise AIRateLimitError(f"AI Rate limit reached during alignment: {e}")
            raise AIGenerationError(f"Alignment failed: {e}")

        return None

    def cache_response(self, video_id, response):
        """Caches AI response to S3."""
        if not self.s3_manager or not response:
            return

        key = f"ai_cache/{video_id}.json"
        logger.info(f"Caching AI response for {video_id}...")
        self.s3_manager.save_json(key, response)

    def _clean_and_parse_json(self, content):
        """
        Cleans and parses JSON content, handling markdown code blocks and extra text.
        """
        content = content.strip()
        # Clean up markdown if present
        if content.startswith("```json"):
            content = content[7:].strip()
        if content.endswith("```"):
            content = content[:-3].strip()

        # Robust JSON extraction: Find start and end to handle extra data
        start_idx = content.find("{")
        end_idx = content.rfind("}")

        if start_idx != -1 and end_idx != -1:
            try:
                # Try to parse the extraction first
                return json.loads(content[start_idx : end_idx + 1])
            except json.JSONDecodeError:
                # If extraction fails, fall back to parsing the whole/cleaned string
                logger.debug("Failed to parse extracted JSON, trying cleaned content.")

        # Fallback or direct parse if braces not found/extraction failed
        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse JSON: {e}")
            # Optionally write to temp for debugging as before
            with open("temp_json_failure.json", "w", encoding="utf-8") as f:
                f.write(content)
            raise e


if __name__ == "__main__":
    from echodhamma.utils.logger import setup_logging

    setup_logging()
    # Simple test if run directly
    manager = AIManager()
    test_url = "https://www.youtube.com/watch?v=rsTQQxtuZvc"
    logger.info(f"Testing Gemini with URL: {test_url}")
    result = manager.generate_metadata(test_url)
    print(json.dumps(result, indent=2, ensure_ascii=False))
