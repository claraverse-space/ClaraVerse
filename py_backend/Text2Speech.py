import os
import logging
import tempfile
import io
from typing import Optional, Union
from pathlib import Path

# Import TTS libraries
try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False

logger = logging.getLogger("clara-text2speech")

class Text2Speech:
    def __init__(self, engine="auto", language="en", slow=False):
        """
        Initialize the Text2Speech processor.
        
        Args:
            engine: TTS engine to use ("gtts", "pyttsx3", or "auto" for automatic selection)
            language: Language code for speech synthesis (default: "en")
            slow: Whether to use slow speech rate (only for gTTS)
        """
        self.language = language
        self.slow = slow
        self.engine = engine
        
        logger.info(f"Initializing Text2Speech with engine={engine}, language={language}")
        
        # Determine which engine to use
        if engine == "auto":
            if GTTS_AVAILABLE:
                self.engine = "gtts"
                logger.info("Using gTTS engine (online)")
            elif PYTTSX3_AVAILABLE:
                self.engine = "pyttsx3"
                logger.info("Using pyttsx3 engine (offline)")
            else:
                raise RuntimeError("No TTS engines available. Please install gtts or pyttsx3.")
        elif engine == "gtts":
            if not GTTS_AVAILABLE:
                raise RuntimeError("gTTS not available. Please install gtts package.")
            self.engine = "gtts"
        elif engine == "pyttsx3":
            if not PYTTSX3_AVAILABLE:
                raise RuntimeError("pyttsx3 not available. Please install pyttsx3 package.")
            self.engine = "pyttsx3"
        else:
            raise ValueError(f"Unknown engine: {engine}. Use 'gtts', 'pyttsx3', or 'auto'.")
        
        # Initialize pyttsx3 engine if needed
        self.pyttsx3_engine = None
        if self.engine == "pyttsx3":
            try:
                self.pyttsx3_engine = pyttsx3.init()
                # Set properties
                self.pyttsx3_engine.setProperty('rate', 150)  # Speed of speech
                self.pyttsx3_engine.setProperty('volume', 0.9)  # Volume level (0.0 to 1.0)
                logger.info("pyttsx3 engine initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize pyttsx3 engine: {e}")
                raise
    
    def synthesize_to_file(self, text: str, output_path: str) -> str:
        """
        Synthesize text to speech and save to a file.
        
        Args:
            text: Text to synthesize
            output_path: Path where to save the audio file
            
        Returns:
            Path to the generated audio file
        """
        try:
            logger.info(f"Synthesizing text to file: {output_path}")
            
            if self.engine == "gtts":
                return self._gtts_to_file(text, output_path)
            elif self.engine == "pyttsx3":
                return self._pyttsx3_to_file(text, output_path)
            else:
                raise ValueError(f"Unknown engine: {self.engine}")
                
        except Exception as e:
            logger.error(f"Error synthesizing text to file: {e}")
            raise
    
    def synthesize_to_bytes(self, text: str) -> bytes:
        """
        Synthesize text to speech and return as bytes.
        
        Args:
            text: Text to synthesize
            
        Returns:
            Audio data as bytes
        """
        try:
            logger.info("Synthesizing text to bytes")
            
            if self.engine == "gtts":
                return self._gtts_to_bytes(text)
            elif self.engine == "pyttsx3":
                return self._pyttsx3_to_bytes(text)
            else:
                raise ValueError(f"Unknown engine: {self.engine}")
                
        except Exception as e:
            logger.error(f"Error synthesizing text to bytes: {e}")
            raise
    
    def _gtts_to_file(self, text: str, output_path: str) -> str:
        """Generate speech using gTTS and save to file"""
        try:
            tts = gTTS(text=text, lang=self.language, slow=self.slow)
            tts.save(output_path)
            logger.info(f"gTTS audio saved to: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"gTTS error: {e}")
            raise
    
    def _gtts_to_bytes(self, text: str) -> bytes:
        """Generate speech using gTTS and return as bytes"""
        try:
            tts = gTTS(text=text, lang=self.language, slow=self.slow)
            
            # Use BytesIO to get the audio data as bytes
            audio_buffer = io.BytesIO()
            tts.write_to_fp(audio_buffer)
            audio_buffer.seek(0)
            audio_bytes = audio_buffer.read()
            
            logger.info("gTTS audio generated as bytes")
            return audio_bytes
        except Exception as e:
            logger.error(f"gTTS error: {e}")
            raise
    
    def _pyttsx3_to_file(self, text: str, output_path: str) -> str:
        """Generate speech using pyttsx3 and save to file"""
        try:
            if self.pyttsx3_engine is None:
                raise RuntimeError("pyttsx3 engine not initialized")
            
            # Save to file
            self.pyttsx3_engine.save_to_file(text, output_path)
            self.pyttsx3_engine.runAndWait()
            
            logger.info(f"pyttsx3 audio saved to: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"pyttsx3 error: {e}")
            raise
    
    def _pyttsx3_to_bytes(self, text: str) -> bytes:
        """Generate speech using pyttsx3 and return as bytes"""
        try:
            # pyttsx3 doesn't directly support bytes output, so we use a temp file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_file:
                temp_path = temp_file.name
            
            try:
                # Generate to temp file
                self._pyttsx3_to_file(text, temp_path)
                
                # Read the file as bytes
                with open(temp_path, 'rb') as f:
                    audio_bytes = f.read()
                
                logger.info("pyttsx3 audio generated as bytes")
                return audio_bytes
            finally:
                # Clean up temp file
                try:
                    os.unlink(temp_path)
                except:
                    pass
                    
        except Exception as e:
            logger.error(f"pyttsx3 error: {e}")
            raise
    
    def get_available_languages(self) -> list:
        """
        Get list of available languages for the current engine.
        
        Returns:
            List of language codes
        """
        if self.engine == "gtts":
            try:
                from gtts.lang import tts_langs
                return list(tts_langs().keys())
            except ImportError:
                logger.warning("Could not import gtts.lang")
                return ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"]
        elif self.engine == "pyttsx3":
            # pyttsx3 language support depends on the system TTS engine
            # Return common language codes
            return ["en", "es", "fr", "de", "it", "pt", "ru"]
        else:
            return ["en"]
    
    def set_language(self, language: str):
        """Set the language for speech synthesis"""
        self.language = language
        logger.info(f"Language set to: {language}")
    
    def set_speed(self, slow: bool):
        """Set speech speed (only for gTTS)"""
        if self.engine == "gtts":
            self.slow = slow
            logger.info(f"Speech speed set to: {'slow' if slow else 'normal'}")
        elif self.engine == "pyttsx3" and self.pyttsx3_engine:
            # For pyttsx3, adjust the rate property
            rate = 120 if slow else 150
            self.pyttsx3_engine.setProperty('rate', rate)
            logger.info(f"pyttsx3 speech rate set to: {rate}") 