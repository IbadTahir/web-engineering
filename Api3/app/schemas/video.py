from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class VideoLectureBase(BaseModel):
    title: str
    description: str
    video_url: str
    subject: str
    topic: str
    notes_url: Optional[str] = None

class VideoLectureCreate(VideoLectureBase):
    pass

class VideoLectureResponse(VideoLectureBase):
    id: int
    teacher_username: str
    created_at: datetime

    class Config:
        from_attributes = True  # Updated for Pydantic v2
