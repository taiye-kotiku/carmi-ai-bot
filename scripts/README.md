# Video Processor Script

Python script for processing videos with MediaPipe selfie segmentation.

## Installation

Install required Python packages:

```bash
pip install -r requirements.txt
```

Or manually:

```bash
pip install opencv-python mediapipe numpy
```

## Usage

### Extract Best Frames

Extract best frames with selfie segmentation:

```bash
python3 scripts/video-processor.py extract <video_path> <count> <output_dir>
```

Example:
```bash
python3 scripts/video-processor.py extract input.mp4 10 ./frames
```

### Merge Video with Background

Merge video with background image:

```bash
python3 scripts/video-processor.py merge <video_path> <background_path> <output_path>
```

Example:
```bash
python3 scripts/video-processor.py merge input.mp4 background.jpg output.mp4
```

## Requirements

- Python 3.8+
- OpenCV 4.8+
- MediaPipe 0.10+
- NumPy 1.24+

## Notes

- The script outputs progress to stderr in the format `PROGRESS:XX`
- Results are output as JSON to stdout
- Temporary files are cleaned up automatically
