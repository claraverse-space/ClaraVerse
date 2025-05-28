#!/usr/bin/env python3
"""
Kokoro TTS Installation Script for Clara
========================================

This script installs Kokoro TTS and its dependencies for high-quality neural text-to-speech.
"""

import subprocess
import sys
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def run_command(command, description):
    """Run a command and handle errors"""
    logger.info(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        logger.info(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ {description} failed:")
        logger.error(f"Command: {command}")
        logger.error(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        logger.error("❌ Python 3.8+ is required for Kokoro TTS")
        return False
    logger.info(f"✅ Python {version.major}.{version.minor}.{version.micro} is compatible")
    return True

def install_kokoro():
    """Install Kokoro TTS and dependencies"""
    logger.info("🚀 Starting Kokoro TTS installation...")
    
    if not check_python_version():
        return False
    
    # Install PyTorch first (CPU version for compatibility)
    if not run_command(
        "pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu",
        "Installing PyTorch (CPU version)"
    ):
        logger.warning("⚠️ PyTorch installation failed, trying alternative method...")
        if not run_command("pip install torch torchvision torchaudio", "Installing PyTorch (default)"):
            return False
    
    # Install audio processing libraries
    packages = [
        "soundfile>=0.12.1",
        "numpy>=1.21.0",
        "scipy>=1.7.0"
    ]
    
    for package in packages:
        if not run_command(f"pip install {package}", f"Installing {package}"):
            return False
    
    # Install Kokoro TTS packages
    kokoro_packages = [
        "kokoro>=0.9.4",
        "kokoro-onnx>=0.4.9",
        "onnxruntime>=1.16.0"
    ]
    
    for package in kokoro_packages:
        if not run_command(f"pip install {package}", f"Installing {package}"):
            logger.warning(f"⚠️ Failed to install {package}, trying alternative...")
            # Try installing from GitHub if PyPI fails
            if "kokoro" in package:
                if not run_command(
                    "pip install git+https://github.com/resemble-ai/kokoro.git",
                    "Installing Kokoro from GitHub"
                ):
                    logger.error(f"❌ Failed to install Kokoro TTS")
                    return False
    
    # Install optional voice packs
    logger.info("🎭 Installing voice packs...")
    voice_packs = [
        "misaki[en]>=0.1.0"  # English voice pack
    ]
    
    for pack in voice_packs:
        run_command(f"pip install {pack}", f"Installing {pack}")
        # Don't fail if voice packs fail - they're optional
    
    logger.info("✅ Kokoro TTS installation completed!")
    return True

def test_installation():
    """Test if Kokoro TTS is working"""
    logger.info("🧪 Testing Kokoro TTS installation...")
    
    try:
        # Test Kokoro ONNX (preferred)
        from kokoro_onnx import KokoroONNX
        kokoro = KokoroONNX()
        logger.info("✅ Kokoro ONNX is working!")
        
        # Test basic synthesis
        test_text = "Hello, this is a test of Kokoro TTS."
        audio = kokoro.generate(test_text, voice="af_sarah", speed=1.0)
        logger.info(f"✅ Generated {len(audio)} audio samples")
        
        return True
        
    except ImportError as e:
        logger.error(f"❌ Kokoro ONNX import failed: {e}")
        
        # Try regular Kokoro
        try:
            from kokoro import KPipeline
            pipeline = KPipeline(lang_code='a')  # American English
            logger.info("✅ Kokoro (PyTorch) is working!")
            return True
        except ImportError as e:
            logger.error(f"❌ Kokoro import failed: {e}")
            return False
    
    except Exception as e:
        logger.error(f"❌ Kokoro test failed: {e}")
        return False

def main():
    """Main installation function"""
    logger.info("🎤 Clara Kokoro TTS Installer")
    logger.info("=" * 40)
    
    if install_kokoro():
        if test_installation():
            logger.info("🎉 Kokoro TTS is ready to use!")
            logger.info("\n📋 Available voices:")
            voices = [
                "af_sarah - American Female (warm, friendly)",
                "af_nicole - American Female (professional)",
                "am_adam - American Male (deep, authoritative)",
                "bf_emma - British Female (elegant)",
                "bm_george - British Male (distinguished)"
            ]
            for voice in voices:
                logger.info(f"  • {voice}")
            
            logger.info("\n🚀 You can now use Kokoro TTS in Clara!")
            logger.info("Restart your Clara backend to enable Kokoro TTS.")
        else:
            logger.error("❌ Installation completed but testing failed")
            logger.error("Please check the error messages above")
            return 1
    else:
        logger.error("❌ Installation failed")
        logger.error("Please check the error messages above")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 