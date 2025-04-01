import pytest
import os
from ai.stt import speech_to_text

def test_large_audio_file_transcription():
    """
    Test that we can successfully transcribe a large audio file (>1024KB)
    and verify the content contains expected text.
    """
    # Path to the large test audio file
    current_dir = os.path.dirname(os.path.abspath(__file__))
    large_audio_path = os.path.join(current_dir, "test_data", "large_audio.mp3")
    
    # Verify test file exists and is large enough
    assert os.path.exists(large_audio_path), f"Test file not found at {large_audio_path}"
    file_size = os.path.getsize(large_audio_path)
    assert file_size > 1024 * 1024, f"Test file must be larger than 1024KB, but is {file_size/1024:.2f}KB"
    
    # Read and process the audio file
    with open(large_audio_path, 'rb') as f:
        audio_bytes = f.read()
    
    # Actually call the API and verify the response
    result = speech_to_text(audio_bytes, "wav")
    
    # Verify we got a response and it contains expected content
    assert result is not None, "Transcription should not be None"
    assert "project" in result, "Expected word 'Project' not found in transcription"
    
    # Log the full transcription for debugging
    print(f"\nTranscription result: {result}") 

    