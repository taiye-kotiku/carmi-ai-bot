#!/usr/bin/env python3
"""
Video to Images Processor using MediaPipe Selfie Segmentation
Extracts best frames with selfie detection and sharpness scoring
Optionally merges video with background image
"""

import cv2
import mediapipe as mp
import numpy as np
import json
import sys
import os
from typing import List, Tuple, Optional
import tempfile

mp_selfie = mp.solutions.selfie_segmentation
mp_drawing = mp.solutions.drawing_utils


def calculate_sharpness(image: np.ndarray) -> float:
    """Calculate image sharpness using Laplacian variance"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return laplacian_var


def has_selfie_segmentation(frame: np.ndarray, segment: mp_selfie.SelfieSegmentation) -> Tuple[bool, float]:
    """Check if frame has selfie segmentation and return quality score"""
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = segment.process(rgb_frame)
    
    if results.segmentation_mask is None:
        return False, 0.0
    
    mask = results.segmentation_mask > 0.5
    segmentation_quality = float(np.mean(results.segmentation_mask))
    
    # Check if there's a significant selfie area (at least 10% of frame)
    selfie_area = np.sum(mask) / (frame.shape[0] * frame.shape[1])
    has_selfie = selfie_area > 0.1 and segmentation_quality > 0.3
    
    return has_selfie, segmentation_quality


def extract_best_frames(
    video_path: str,
    count: int,
    output_dir: str
) -> List[dict]:
    """Extract best frames with selfie segmentation"""
    cap = cv2.VideoCapture(video_path)
    segment = mp_selfie.SelfieSegmentation(model_selection=1)  # 1 for video
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    candidates = []
    frame_idx = 0
    
    print(f"Processing {frame_count} frames...", file=sys.stderr)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        timestamp = frame_idx / fps if fps > 0 else frame_idx * 0.033
        
        # Calculate sharpness
        sharpness = calculate_sharpness(frame)
        
        # Check for selfie segmentation
        has_selfie, seg_quality = has_selfie_segmentation(frame, segment)
        
        if has_selfie:
            # Combined score: sharpness + segmentation quality
            score = sharpness * 0.6 + seg_quality * 1000 * 0.4
            
            candidates.append({
                'frame_idx': frame_idx,
                'timestamp': timestamp,
                'score': score,
                'sharpness': sharpness,
                'seg_quality': seg_quality,
                'frame': frame.copy()
            })
        
        frame_idx += 1
        
        # Progress update every 10%
        if frame_idx % (frame_count // 10) == 0:
            progress = int((frame_idx / frame_count) * 100)
            print(f"PROGRESS:{progress}", file=sys.stderr)
    
    cap.release()
    
    # Sort by score and take top N
    candidates.sort(key=lambda x: x['score'], reverse=True)
    best_frames = candidates[:count]
    
    # Save frames
    results = []
    for i, candidate in enumerate(best_frames):
        output_path = os.path.join(output_dir, f"frame_{i+1}.jpg")
        cv2.imwrite(output_path, candidate['frame'])
        
        results.append({
            'index': i + 1,
            'timestamp': candidate['timestamp'],
            'score': candidate['score'],
            'path': output_path
        })
    
    return results


def merge_video_with_background(
    video_path: str,
    background_path: str,
    output_path: str
) -> str:
    """Merge video with background image using selfie segmentation"""
    cap = cv2.VideoCapture(video_path)
    segment = mp_selfie.SelfieSegmentation(model_selection=1)
    
    # Load background image
    bg_image = cv2.imread(background_path)
    if bg_image is None:
        raise ValueError("Could not load background image")
    
    # Get video properties
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Resize background to match video dimensions
    bg_image = cv2.resize(bg_image, (width, height))
    
    # Setup video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_idx = 0
    
    print(f"Merging {frame_count} frames...", file=sys.stderr)
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        # Get segmentation mask
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = segment.process(rgb_frame)
        
        if results.segmentation_mask is not None:
            mask = results.segmentation_mask > 0.1
            
            # Create 3-channel mask
            condition = np.stack((mask,) * 3, axis=-1)
            
            # Merge: foreground where mask is True, background elsewhere
            output_frame = np.where(condition, frame, bg_image).astype(np.uint8)
        else:
            # No segmentation, use original frame
            output_frame = frame
        
        out.write(output_frame)
        frame_idx += 1
        
        # Progress update
        if frame_idx % (frame_count // 10) == 0:
            progress = int((frame_idx / frame_count) * 100)
            print(f"PROGRESS:{progress}", file=sys.stderr)
    
    cap.release()
    out.release()
    
    return output_path


def main():
    if len(sys.argv) < 3:
        print("Usage: video-processor.py <command> <args...>", file=sys.stderr)
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "extract":
        # Extract best frames
        # Args: video_path, count, output_dir
        video_path = sys.argv[2]
        count = int(sys.argv[3])
        output_dir = sys.argv[4]
        
        os.makedirs(output_dir, exist_ok=True)
        results = extract_best_frames(video_path, count, output_dir)
        
        print(json.dumps(results))
        
    elif command == "merge":
        # Merge video with background
        # Args: video_path, background_path, output_path
        video_path = sys.argv[2]
        background_path = sys.argv[3]
        output_path = sys.argv[4]
        
        merge_video_with_background(video_path, background_path, output_path)
        print(json.dumps({"output_path": output_path}))
        
    else:
        print(f"Unknown command: {command}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
