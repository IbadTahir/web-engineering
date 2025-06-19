from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ....database.database import get_db
from ....models.book import Book, BookLending
from ....schemas.book import BookCreate, BookResponse, BookLendingCreate, BookLendingResponse
from ....utils.external_auth import verify_token_from_user_management_api, require_teacher_or_admin
from datetime import datetime

router = APIRouter()

@router.post("/upload", response_model=BookResponse)
def upload_book(
    book: BookCreate,
    db: Session = Depends(get_db)
    # Temporarily removed authentication for testing
    # user_data: dict = Depends(require_teacher_or_admin)
):
    db_book = Book(
        title=book.title,
        file_path=book.file_path,
        copies_owned=book.copies_owned,
        copies_available=book.copies_owned,
        tags=book.tags
    )
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book

@router.get("/available", response_model=List[BookResponse])
def get_available_books(
    db: Session = Depends(get_db)
):
    # Public endpoint - no authentication required for browsing books
    return db.query(Book).filter(Book.copies_available > 0).all()

@router.post("/rent", response_model=BookLendingResponse)
def lend_book(
    lending: BookLendingCreate,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    book = db.query(Book).filter(Book.id == lending.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    if book.copies_available <= 0:
        raise HTTPException(status_code=400, detail="No copies available")
    
    # Check if user already has an active lending for this book
    active_lending = db.query(BookLending).filter(
        BookLending.book_id == lending.book_id,
        BookLending.username == user_data["email"],  # Use email as username
        BookLending.is_active == 1
    ).first()
    
    if active_lending:
        raise HTTPException(
            status_code=400,
            detail="You already have an active lending for this book"
        )
    
    db_lending = BookLending(
        book_id=lending.book_id,
        username=user_data["email"]  # Use email as username
    )
    
    book.copies_available -= 1
    
    db.add(db_lending)
    db.commit()
    db.refresh(db_lending)
    return db_lending

@router.post("/return/{lending_id}")
def return_book(
    lending_id: int,
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    lending = db.query(BookLending).filter(
        BookLending.id == lending_id,
        BookLending.username == user_data["email"],  # Use email as username
        BookLending.is_active == 1
    ).first()
    
    if not lending:
        raise HTTPException(status_code=404, detail="Active lending not found")
    
    lending.is_active = 0
    lending.return_date = datetime.utcnow()
    
    book = db.query(Book).filter(Book.id == lending.book_id).first()
    book.copies_available += 1
    
    db.commit()
    return {"message": "Book returned successfully"}

@router.get("/search")
def search_books(
    query: str,
    db: Session = Depends(get_db)
):
    # Public endpoint - no authentication required for searching books
    return db.query(Book).filter(
        (Book.title.ilike(f"%{query}%")) |
        (Book.tags.ilike(f"%{query}%"))
    ).all()

@router.get("/active", response_model=List[BookLendingResponse])
def get_active_lendings(
    db: Session = Depends(get_db),
    user_data: dict = Depends(verify_token_from_user_management_api)
):
    return db.query(BookLending).filter(
        BookLending.username == user_data["email"],  # Use email as username
        BookLending.is_active == 1
    ).all()
