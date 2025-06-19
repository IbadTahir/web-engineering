from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from ....database.database import get_db
from ....models.evaluator import Evaluator, EvaluatorSubmission, EvaluatorType
from ....schemas.evaluator import (
    EvaluatorCreate,
    EvaluatorResponse,
    EvaluatorUpdate,
    SubmissionCreate,
    SubmissionResponse,
    EvaluatorStatusResponse,
    QuizType,
    GradeSubmission
)
from ....utils.external_auth import verify_token_from_user_management_api, require_teacher_or_admin
from ....utils.gemini_utils import evaluate_quiz, evaluate_multiple_choice, evaluate_code
import logging
import json
from datetime import datetime
from fastapi import Query

router = APIRouter()

@router.post("/", response_model=EvaluatorResponse)
def create_evaluator(
    evaluator: EvaluatorCreate,
    db: Session = Depends(get_db)
    # Temporarily removed authentication for testing
    # user_data: dict = Depends(require_teacher_or_admin)
):
    db_evaluator = Evaluator(
        title=evaluator.title,
        description=evaluator.description,
        type=evaluator.type,
        teacher_username="demo-teacher",  # Use demo teacher for testing
        submission_type=evaluator.submission_type,
        is_auto_eval=int(evaluator.is_auto_eval) if evaluator.is_auto_eval else 0,
        deadline=evaluator.deadline,
        quiz_type=evaluator.quiz_type,
        quiz_data=evaluator.quiz_data,
        max_attempts=evaluator.max_attempts
    )
    db.add(db_evaluator)
    db.commit()
    db.refresh(db_evaluator)
    return db_evaluator.to_dict()

@router.get("/list")
def get_evaluators(
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = Query(None, description="Search in title and description"),
    type: Optional[str] = Query(None, pattern="^(quiz|assignment)$"),
    quiz_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
    # Public endpoint - no authentication required for browsing evaluators
):
    query = db.query(Evaluator)
    
    if search:
        query = query.filter(
            (Evaluator.title.contains(search)) | 
            (Evaluator.description.contains(search))
        )
    
    if type:
        query = query.filter(Evaluator.type == type)
        
    if quiz_type:
        query = query.filter(Evaluator.quiz_type == quiz_type)
    
    total = query.count()
    evaluators = query.offset(skip).limit(limit).all()
    
    evaluator_list = [evaluator.to_dict() for evaluator in evaluators]
    
    return {
        "items": evaluator_list,
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": (skip + limit) < total
    }

@router.post("/{evaluator_id}/submit", response_model=SubmissionResponse)
async def submit_response(
    evaluator_id: int,
    submission: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")
      # Check submission deadline
    deadline = getattr(evaluator, 'deadline', None)
    if deadline and datetime.now() > deadline:
        raise HTTPException(status_code=400, detail="Submission deadline has passed")    # Check max attempts
    existing_submissions = db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.evaluator_id == evaluator_id,
        EvaluatorSubmission.student_username == user_data["email"]  # Use email as username
    ).count()

    max_attempts = getattr(evaluator, 'max_attempts', 1)
    if existing_submissions >= max_attempts:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum attempts ({evaluator.max_attempts}) reached"
        )

    db_submission = EvaluatorSubmission(
        evaluator_id=evaluator_id,
        student_username=user_data["email"],  # Use email as username
        submission_content=submission.submission_content,
        status="submitted"
    )# If it's an auto-evaluated quiz
    is_auto_eval = getattr(evaluator, 'is_auto_eval', 0)
    evaluator_type = getattr(evaluator, 'type', None)
    if is_auto_eval and evaluator_type == EvaluatorType.QUIZ:
        try:
            quiz_data = getattr(evaluator, 'quiz_data', None) or {}
            quiz_type = getattr(evaluator, 'quiz_type', None)
            if quiz_type == QuizType.MULTIPLE_CHOICE:
                # For multiple choice quizzes
                student_answers = json.loads(submission.submission_content)
                score, feedback = await evaluate_multiple_choice(
                    correct_answers=quiz_data.get("correct_answers", []),
                    student_answers=student_answers
                )
            elif quiz_type == QuizType.CODE_EVALUATION:
                # For code evaluation quizzes
                description = getattr(evaluator, 'description', '') or ""
                score, feedback = await evaluate_code(
                    problem_description=description,
                    test_cases=quiz_data.get("test_cases", []),
                    student_code=submission.submission_content,
                    language=quiz_data.get("language", "python")
                )
            else:
                # For open-ended quizzes
                description = getattr(evaluator, 'description', '') or ""
                score, feedback = await evaluate_quiz(
                    quiz_content=description,
                    student_answer=submission.submission_content
                )

            setattr(db_submission, 'provisional_grade', score)
            setattr(db_submission, 'feedback', feedback)
            setattr(db_submission, 'status', "auto_graded")
            
        except Exception as e:
            logging.error(f"Auto-evaluation failed: {str(e)}")
            setattr(db_submission, 'status', "submitted_pending_auto_grade")
            setattr(db_submission, 'feedback', "Auto-evaluation failed. A teacher will review your submission manually.")

    db.add(db_submission)
    db.commit()
    db.refresh(db_submission)
    return db_submission.to_dict()

@router.post("/{evaluator_id}/grade/{submission_id}", response_model=SubmissionResponse)
def grade_submission(    evaluator_id: int,
    submission_id: int,
    grade_data: GradeSubmission,
    db: Session = Depends(get_db),
    user_data: dict = Depends(require_teacher_or_admin)
):
    submission = db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.id == submission_id,
        EvaluatorSubmission.evaluator_id == evaluator_id
    ).first()
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")
    # Check if the teacher owns this evaluator
    teacher_username = getattr(evaluator, 'teacher_username', None)
    # Allow any instructor/admin to grade submissions, not just the creator
    # if teacher_username != user_data["email"]:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You can only grade submissions for your own evaluators"
    #     )
    
    setattr(submission, 'final_grade', grade_data.grade)
    setattr(submission, 'feedback', grade_data.feedback)
    setattr(submission, 'status', "graded")
    
    db.commit()
    db.refresh(submission)
    return submission.to_dict()

@router.get("/{evaluator_id}/submissions", response_model=List[SubmissionResponse])
def get_submissions(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(require_teacher_or_admin)
):
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")

    # Allow any instructor/admin to view submissions, not just the creator
    # This is more flexible for educational platforms where multiple instructors may manage evaluations
    # if evaluator.teacher_username != user_data["email"]:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="You can only view submissions for your own evaluators"
    #     )

    submissions = db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.evaluator_id == evaluator_id
    ).all()
    
    return [submission.to_dict() for submission in submissions]

@router.get("/{evaluator_id}/status", response_model=EvaluatorStatusResponse)
async def check_submission_status(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    """Check the submission status for a student's submission"""
    submission = db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.evaluator_id == evaluator_id,
        EvaluatorSubmission.student_username == user_data["email"]
    ).first()
    
    if not submission:        return EvaluatorStatusResponse(
            status="not_submitted"
        )
    
    return EvaluatorStatusResponse(
        status=getattr(submission, 'status', ''),
        submission_date=getattr(submission, 'submission_date', None),
        provisional_grade=getattr(submission, 'provisional_grade', None),
        final_grade=getattr(submission, 'final_grade', None),
        feedback=getattr(submission, 'feedback', None),
        grade=getattr(submission, 'final_grade', None) if getattr(submission, 'status', '') == "graded" else getattr(submission, 'provisional_grade', None)
    )

@router.get("/{evaluator_id}/view", response_model=EvaluatorResponse)
async def view_evaluator_details(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    """View detailed information about an evaluator"""
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")
    return evaluator.to_dict()

@router.post("/{evaluator_id}/evaluate")
async def trigger_auto_evaluation(
    evaluator_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    """Manually trigger auto-evaluation for a specific submission"""
    submission = db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.id == submission_id,
        EvaluatorSubmission.evaluator_id == evaluator_id
    ).first()
    
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")
        
    is_auto_eval = getattr(evaluator, 'is_auto_eval', 0)
    evaluator_type = getattr(evaluator, 'type', None)
    if not is_auto_eval or evaluator_type != EvaluatorType.QUIZ:
        raise HTTPException(
            status_code=400,
            detail="This evaluator does not support auto-evaluation"
        )
    
    try:
        quiz_data = getattr(evaluator, 'quiz_data', None) or {}
        quiz_type = getattr(evaluator, 'quiz_type', None)
        if quiz_type == QuizType.MULTIPLE_CHOICE:
            # For multiple choice quizzes
            submission_content = getattr(submission, 'submission_content', '')
            student_answers = json.loads(submission_content)
            score, feedback = await evaluate_multiple_choice(
                correct_answers=quiz_data.get("correct_answers", []),
                student_answers=student_answers
            )
        elif quiz_type == QuizType.CODE_EVALUATION:
            # For code evaluation quizzes
            description = getattr(evaluator, 'description', '') or ""
            submission_content = getattr(submission, 'submission_content', '')
            score, feedback = await evaluate_code(
                problem_description=description,
                test_cases=quiz_data.get("test_cases", []),
                student_code=submission_content,
                language=quiz_data.get("language", "python")
            )
        else:
            # For open-ended quizzes
            description = getattr(evaluator, 'description', '') or ""
            submission_content = getattr(submission, 'submission_content', '')
            score, feedback = await evaluate_quiz(
                quiz_content=description,
                student_answer=submission_content
            )
            
        # Update submission with evaluation results
        setattr(submission, 'provisional_grade', score)
        setattr(submission, 'feedback', feedback)
        setattr(submission, 'status', "auto_graded")
        
        db.commit()
        db.refresh(submission)
        
        return {
            "message": "Auto-evaluation complete",
            "provisional_grade": score,
            "feedback": feedback
        }
    except Exception as e:
        setattr(submission, 'status', "auto_eval_failed")
        db.commit()
        raise HTTPException(
            status_code=500,
            detail=f"Auto-evaluation failed: {str(e)}"
        )

@router.get("/{evaluator_id}/result", response_model=List[SubmissionResponse])
async def get_evaluation_results(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    """Get evaluation results for the student's submissions"""
    submissions = db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.evaluator_id == evaluator_id,
        EvaluatorSubmission.student_username == user_data["email"]
    ).all()
    
    return [submission.to_dict() for submission in submissions]

@router.put("/{evaluator_id}", response_model=EvaluatorResponse)
def update_evaluator(
    evaluator_id: int,
    evaluator: EvaluatorUpdate,
    db: Session = Depends(get_db),
    user_data: dict = Depends(require_teacher_or_admin)
):
    db_evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not db_evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")

    if db_evaluator.teacher_username != user_data["email"]:
        raise HTTPException(
            status_code=403,
            detail="Only the creator can update this evaluator"
        )

    update_data = evaluator.model_dump(exclude_unset=True)

    # Special validations for quiz type updates
    if "quiz_type" in update_data:
        # Check for existing submissions
        submissions = db.query(EvaluatorSubmission).filter(
            EvaluatorSubmission.evaluator_id == evaluator_id
        ).count()
        if submissions > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot change quiz type after submissions exist"
            )
              # Validate quiz type and quiz data relationship
        if update_data["quiz_type"] == QuizType.MULTIPLE_CHOICE:
            quiz_data = getattr(db_evaluator, 'quiz_data', None) or {}
            if not quiz_data or "questions" not in quiz_data or "correct_answers" not in quiz_data:
                raise HTTPException(
                    status_code=400,
                    detail="Multiple choice quizzes require questions and correct_answers in quiz_data"
                )
                
    # Validate quiz data if being updated
    quiz_type = getattr(db_evaluator, 'quiz_type', None)
    if "quiz_data" in update_data and quiz_type == QuizType.MULTIPLE_CHOICE:
        quiz_data = update_data["quiz_data"]
        if not quiz_data or "questions" not in quiz_data or "correct_answers" not in quiz_data:
            raise HTTPException(
                status_code=400,
                detail="Multiple choice quizzes require questions and correct_answers"
            )
        if len(quiz_data["questions"]) != len(quiz_data["correct_answers"]):
            raise HTTPException(
                status_code=400,
                detail="Number of questions must match number of answers"
            )

    # Special handling for boolean conversion
    if "is_auto_eval" in update_data:
        update_data["is_auto_eval"] = int(bool(update_data["is_auto_eval"]))
        
        # If enabling auto eval, validate quiz type is set
        if update_data["is_auto_eval"] and db_evaluator.quiz_type is None and "quiz_type" not in update_data:
            raise HTTPException(
                status_code=400,
                detail="Auto-evaluated quizzes must specify quiz_type"
            )

    # Apply updates
    for key, value in update_data.items():
        setattr(db_evaluator, key, value)

    db.commit()
    db.refresh(db_evaluator)
    return db_evaluator.to_dict()

@router.delete("/{evaluator_id}")
def delete_evaluator(
    evaluator_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(require_teacher_or_admin)
):
    evaluator = db.query(Evaluator).filter(Evaluator.id == evaluator_id).first()
    if not evaluator:
        raise HTTPException(status_code=404, detail="Evaluator not found")

    if evaluator.teacher_username != user_data["email"]:
        raise HTTPException(
            status_code=403,
            detail="Only the creator can delete this evaluator"
        )
    
    # Delete all submissions first
    db.query(EvaluatorSubmission).filter(
        EvaluatorSubmission.evaluator_id == evaluator_id
    ).delete()
    
    # Delete the evaluator
    db.delete(evaluator)
    db.commit()
    
    return {"message": "Evaluator deleted successfully"}
