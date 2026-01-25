import subprocess
import json
import os

# Audio processing configuration
AUDIO_CHANNELS = 1  # Mono
AUDIO_SAMPLE_RATE = 44100  # Hz
AUDIO_BITRATE = "64k"  # kbps - optimized for speech
LOUDNORM_INTEGRATED = -19  # LUFS target loudness
LOUDNORM_TRUE_PEAK = -1.5  # dBTP max true peak
LOUDNORM_LRA = 11  # LU loudness range


class AudioProcessor:
    def __init__(self, thero_name):
        self.thero_name = thero_name

    def _get_loudness_stats(self, input_file):
        safe_input = (
            f"./{input_file}"
            if not os.path.isabs(input_file) and not input_file.startswith("./")
            else input_file
        )
        cmd = [
            "ffmpeg",
            "-i",
            safe_input,
            "-af",
            f"loudnorm=I={LOUDNORM_INTEGRATED}:TP={LOUDNORM_TRUE_PEAK}:LRA={LOUDNORM_LRA}:print_format=json",
            "-f",
            "null",
            "-",
        ]
        result = subprocess.run(
            cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True
        )

        output = result.stderr
        json_start = output.find("{")
        json_end = output.rfind("}") + 1
        if json_start != -1 and json_end != -1:
            try:
                return json.loads(output[json_start:json_end])
            except json.JSONDecodeError:
                pass
        return None

    def convert_to_mp3(self, input_file, output_file):
        stats = self._get_loudness_stats(input_file)
        loudnorm_filter = f"loudnorm=I={LOUDNORM_INTEGRATED}:TP={LOUDNORM_TRUE_PEAK}:LRA={LOUDNORM_LRA}"

        if stats:
            loudnorm_filter += (
                f":measured_I={stats['input_i']}:measured_LRA={stats['input_lra']}"
                f":measured_TP={stats['input_tp']}:measured_thresh={stats['input_thresh']}"
                f":offset={stats['target_offset']}:linear=true"
            )
        else:
            print(f"[{self.thero_name}] Warn: Using single-pass normalization.")

        safe_input = (
            f"./{input_file}"
            if not os.path.isabs(input_file) and not input_file.startswith("./")
            else input_file
        )
        cmd = [
            "ffmpeg",
            "-i",
            safe_input,
            "-ac",
            str(AUDIO_CHANNELS),
            "-ar",
            str(AUDIO_SAMPLE_RATE),
            "-b:a",
            AUDIO_BITRATE,
            "-af",
            loudnorm_filter,
            "-y",
            output_file,
        ]
        subprocess.run(
            cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE
        )
