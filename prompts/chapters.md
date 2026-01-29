
5. **Chapter Segmentation (CRITICAL)**:
   * **Source of Truth**: You MUST identify the start of a new topic within the **Transcript** text and copy the exact timestamp associated with that line. DO NOT estimate timestamps from the video duration.
   * **Language**: Sinhala.
   * **Granularity**: Break the content into logical segments based on topic shifts.
   * **Start Time**: Provide the starting timestamp strictly in **"HH:MM:SS"** format.
   * **Timestamp Extraction Rules**:
      1. Locate the specific Sinhala phrase where the topic shifts.
      2. Look at the square bracketed timestamp `[HH:MM:SS]` immediately **preceding** that phrase.
      3. Use that exact string as the `start_time`.
      4. Do NOT attempt to calculate time; only copy-paste the found timestamp.
   * **Title**:
      * Create a concise title for the segment.
      * **CRITICAL Q&A RULE**: If `isQ&A` is `true`, the `title` **MUST** be the summary of the question asked (e.g., "Why do we meditate?" instead of "Answer about meditation").
   * **Description**: Provide a brief summary of the points discussed in that chapter. Strictly **under 200 words**.
   * **Strict Objectivity**: Summarize only the factual points covered by the Thero. No commentaries or additional information. If no facts are mentioned, return null.
   * **isQ&A**: Set to `true` if the segment is a direct response to a question from an audience member or interviewer. Set to `false` for general Dhamma talk segments.
