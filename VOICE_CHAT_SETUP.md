# Voice Chat Setup Guide

## How to Enable Voice Chat in Clara

Voice chat requires microphone access to detect speech and record audio. Follow these steps to set it up:

### 1. Grant Microphone Permission

When you first try to use voice chat, your browser will ask for microphone permission:

#### Chrome/Edge:
1. Click the microphone icon in the address bar
2. Select "Allow" for microphone access
3. If you previously denied access, click the lock icon → Site settings → Microphone → Allow

#### Firefox:
1. Click "Allow" when prompted for microphone access
2. If you previously denied access, click the shield icon → Permissions → Microphone → Allow

#### Safari:
1. Click "Allow" when prompted for microphone access
2. If you previously denied access, go to Safari → Settings → Websites → Microphone → Allow

### 2. Voice Chat Features

Clara's voice chat includes:

- **Voice Activity Detection (VAD)**: Automatically detects when you start and stop speaking
- **Manual Recording**: Fallback option if VAD fails to initialize
- **Real-time Audio Visualization**: Shows audio levels and speaking status
- **Text-to-Speech**: Clara can speak responses back to you

### 3. Troubleshooting

#### "Permission denied" error:
- Make sure you clicked "Allow" when prompted for microphone access
- Check your browser's site settings and ensure microphone is allowed
- Try refreshing the page and granting permission again

#### "VAD: ⏳ Loading..." stuck:
- This usually means microphone permission was denied
- Grant microphone permission and the VAD will initialize automatically
- You can also use "Continue without VAD" for manual recording mode

#### Voice chat button is grayed out:
- Click "Grant Microphone Access" to request permissions
- Make sure your microphone is connected and working
- Try refreshing the page if the button remains disabled

#### No audio playback:
- Check your system volume and browser audio settings
- Make sure the backend server is running (should show "✅ Ready" status)
- Verify the TTS service is working in the backend

### 4. Backend Requirements

The voice chat feature requires the Python backend to be running:

```bash
cd py_backend
python main.py --host 0.0.0.0 --port 5001
```

The backend provides:
- Speech-to-text transcription
- Text-to-speech synthesis
- Audio processing capabilities

### 5. Browser Compatibility

Voice chat works best with:
- Chrome 88+ (recommended)
- Firefox 85+
- Safari 14+
- Edge 88+

### 6. Privacy Notes

- Audio is processed locally when possible
- Speech-to-text may use cloud services depending on configuration
- No audio is stored permanently unless explicitly saved
- Microphone access is only active when voice chat is enabled

## Status Indicators

- **VAD: ✅ Ready** - Voice Activity Detection is working
- **VAD: ⏳ Loading...** - VAD is initializing (may need microphone permission)
- **Mic: ✅ Allowed** - Microphone permission granted
- **Mic: ❌ Denied** - Microphone permission denied
- **Mic: ⏳ Requesting...** - Currently requesting permission
- **Mic: ❓ Unknown** - Permission status unknown

## Getting Help

If you continue to have issues:
1. Check the browser console for error messages
2. Verify your microphone works in other applications
3. Try using a different browser
4. Restart the backend server if audio processing fails 