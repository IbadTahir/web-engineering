from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from ....database.database import get_db
from ....models.video import VideoLecture
from ....schemas.video import VideoLectureCreate, VideoLectureResponse
from ....utils.external_auth import verify_token_from_user_management_api, require_teacher_or_admin

router = APIRouter()

@router.post("/", response_model=VideoLectureResponse)
def create_video_lecture(
    video: VideoLectureCreate,
    db: Session = Depends(get_db)
    # Temporarily removed authentication for testing
    # user_data: dict = Depends(require_teacher_or_admin)
):
    video_data = video.model_dump()
    video_data['teacher_username'] = "demo-teacher"  # Use demo teacher for testing
    
    db_video = VideoLecture(**video_data)
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video

@router.get("/", response_model=List[VideoLectureResponse])
def get_video_lectures(
    subject: Optional[str] = None,
    topic: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # Public endpoint - no authentication required for browsing videos
    query = db.query(VideoLecture)
    if subject:
        query = query.filter(VideoLecture.subject == subject)
    if topic:
        query = query.filter(VideoLecture.topic == topic)
    return query.all()

@router.get("/{video_id}", response_model=VideoLectureResponse)
def get_video_lecture(
    video_id: int,
    db: Session = Depends(get_db)
):
    # Public endpoint - no authentication required for viewing individual videos
    video = db.query(VideoLecture).filter(VideoLecture.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video lecture not found")
    return video

@router.get("/teacher/lectures", response_model=List[VideoLectureResponse])
def get_teacher_lectures(
    db: Session = Depends(get_db),
    user_data: dict = Depends(require_teacher_or_admin)
):
    return db.query(VideoLecture).filter(VideoLecture.teacher_username == user_data["email"]).all()

@router.delete("/{video_id}")
def delete_video_lecture(
    video_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(require_teacher_or_admin)
):
    video = db.query(VideoLecture).filter(
        VideoLecture.id == video_id,
        VideoLecture.teacher_username == user_data["email"]  # Use email as username
    ).first()
    
    if not video:
        raise HTTPException(status_code=404, detail="Video lecture not found or unauthorized")
    
    db.delete(video)
    db.commit()
    return {"message": "Video lecture deleted successfully"}
