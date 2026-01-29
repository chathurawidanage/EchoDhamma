import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

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
            print("Warning: GEMINI_API_KEY not found in environment variables.")

        # Initialize the new GenAI client
        self.client = genai.Client(api_key=api_key)

        self.model_name = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

        # Initialize Prompt Service
        from prompt_service import PromptService

        self.prompt_service = PromptService()

    def generate_metadata(self, video_url, transcript_path=None):
        """
        Calls Gemini to generate metadata using PromptService.

        Args:
            video_url (str): The YouTube video URL.
            transcript_path (str, optional): Local path to the transcript file.
            include_chapters (bool, optional): Whether to request chapters in the output.
        """
        # Get the prompt from the service
        prompt_text = self.prompt_service.get_prompt(
            include_chapters=transcript_path is not None
        )

        try:
            # Construct content with video file data and prompt text as separate parts
            parts = [
                types.Part(file_data=types.FileData(file_uri=video_url)),
                types.Part(text=prompt_text),
            ]

            # Add transcript if available
            if transcript_path and os.path.exists(transcript_path):
                print(f"Uploading transcript to Gemini from {transcript_path}...")
                # upload method typically takes 'file' or just the path
                transcript_file = self.client.files.upload(file=transcript_path)
                print(f"Using transcript URI: {transcript_file.uri}")
                parts.insert(
                    1,
                    types.Part(file_data=types.FileData(file_uri=transcript_file.uri)),
                )

            content = types.Content(parts=parts)

            response = self.client.models.generate_content(
                model=self.model_name,
                contents=content,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0,
                ),
            )

            if response and response.text:
                content = response.text.strip()
                # Clean up markdown if present
                if content.startswith("```json"):
                    content = content[7:].strip()
                if content.endswith("```"):
                    content = content[:-3].strip()

                return json.loads(content)
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
        print(f"Checking AI cache for {video_id}...")
        return self.s3_manager.get_json(key)

    def cache_response(self, video_id, response):
        """Caches AI response to S3."""
        if not self.s3_manager or not response:
            return

        key = f"ai_cache/{video_id}.json"
        print(f"Caching AI response for {video_id}...")
        self.s3_manager.save_json(key, response)


if __name__ == "__main__":
    # Simple test if run directly
    manager = AIManager()
    test_url = "https://www.youtube.com/watch?v=rsTQQxtuZvc"
    print(f"Testing Gemini with URL: {test_url}")
    result = manager.generate_metadata(test_url)
    print(json.dumps(result, indent=2, ensure_ascii=False))
