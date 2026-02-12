#!/usr/bin/env python3
"""
Flask API service for video processing with MediaPipe
Run this on a server with Python and MediaPipe installed
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import mediapipe as mp
import numpy as np
import base64
import tempfile
import os
import json
from typing import List, Tuple

app = Flask(__name__)
CORS(app)

mp_selfie = mp.solutions.selfie_segmentation
segment = mp_selfie.SelfieSegmentation(model_selection=1)


def calculate_sharpness(image: np.ndarray) -> float:
    """Calculate image sharpness using Laplacian variance"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    return laplacian_var


def has_selfie_segmentation(frame: np.ndarray) -> Tuple[bool, float]:
    """Check if frame has selfie segmentation and return quality score"""
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = segment.process(rgb_frame)
    
    if results.segmentation_mask is None:
        return False, 0.0
    
    mask = results.segmentation_mask > 0.5
    segmentation_quality = float(np.mean(results.segmentation_mask))
    
    selfie_area = np.sum(mask) / (frame.shape[0] * frame.shape[1])
    has_selfie = selfie_area > 0.1 and segmentation_quality > 0.3
    
    return has_selfie, segmentation_quality


@app.route("/process-video", methods=["POST"])
def process_video():
    try:
        data = request.json
        action = data.get("action")
        video_base64 = data.get("video_base64")
        background_base64 = data.get("background_base64")
        image_count = data.get("image_count", 10)
        
        if not video_base64:
            return jsonify({"error": "No video provided"}), 400
        
        # Decode video
        video_data = base64.b64decode(video_base64)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as video_file:
            video_file.write(video_data)
            video_path = video_file.name
        
        try:
            if action == "extract_frames":
                return extract_frames(video_path, image_count)
            elif action == "merge_video":
                if not background_base64:
                    return jsonify({"error": "No background image provided"}), 400
                bg_data = base64.b64decode(background_base64)
                with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as bg_file:
                    bg_file.write(bg_data)
                    bg_path = bg_file.name
                try:
                    return merge_video(video_path, bg_path)
                finally:
                    os.unlink(bg_path)
            else:
                return jsonify({"error": "Invalid action"}), 400
        finally:
            os.unlink(video_path)
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def extract_frames(video_path: str, count: int):
    """Extract best frames with selfie segmentation"""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    candidates = []
    frame_idx = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        timestamp = frame_idx / fps if fps > 0 else frame_idx * 0.033
        sharpness = calculate_sharpness(frame)
        has_selfie, seg_quality = has_selfie_segmentation(frame)
        
        if has_selfie:
            score = sharpness * 0.6 + seg_quality * 1000 * 0.4
            candidates.append({
                "frame_idx": frame_idx,
                "timestamp": timestamp,
                "score": score,
                "frame": frame,
            })
        
        frame_idx += 1
    
    cap.release()
    
    # Sort and take top N
    candidates.sort(key=lambda x: x["score"], reverse=True)
    best_frames = candidates[:count]
    
    # Encode frames to base64
    frames_data = []
    for i, candidate in enumerate(best_frames):
        _, buffer = cv2.imencode(".jpg", candidate["frame"])
        frame_base64 = base64.b64encode(buffer).decode("utf-8")
        frames_data.append({
            "index": i + 1,
            "timestamp": candidate["timestamp"],
            "score": candidate["score"],
            "data": frame_base64,
        })
    
    return jsonify({
        "frames": frames_data,
        "progress": 100,
    })


def merge_video(video_path: str, background_path: str):
    """Merge video with background image"""
    cap = cv2.VideoCapture(video_path)
    bg_image = cv2.imread(background_path)
    
    fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    bg_image = cv2.resize(bg_image, (width, height))
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as output_file:
        output_path = output_file.name
    
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_idx = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
        
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = segment.process(rgb_frame)
        
        if results.segmentation_mask is not None:
            mask = results.segmentation_mask > 0.1
            condition = np.stack((mask,) * 3, axis=-1)
            output_frame = np.where(condition, frame, bg_image).astype(np.uint8)
        else:
            output_frame = frame
        
        out.write(output_frame)
        frame_idx += 1
    
    cap.release()
    out.release()
    
    # Read and encode output video
    with open(output_path, "rb") as f:
        video_data = f.read()
    
    os.unlink(output_path)
    
    video_base64 = base64.b64encode(video_data).decode("utf-8")
    
    return jsonify({
        "video_base64": video_base64,
        "progress": 100,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
