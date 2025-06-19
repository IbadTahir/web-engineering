import google.generativeai as genai  # type: ignore
from typing import Optional, List, Dict, Any, Tuple, Union
from ..config import get_settings
import json
import asyncio
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# Type hint for Gemini model - using Any to avoid type checker issues
GeminiModel = Union[Any, None]

# Configure the Gemini API
def configure_gemini() -> GeminiModel:
    """Configure Gemini API with proper error handling"""
    try:
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your-gemini-api-key-here":
            logger.warning("Gemini API key not configured. Auto-evaluation will use fallback mode.")
            return None
        
        genai.configure(api_key=settings.GEMINI_API_KEY)  # type: ignore
        model = genai.GenerativeModel('gemini-1.5-flash')  # type: ignore
        
        # Test the API with a simple call
        try:
            test_response = model.generate_content("Test")
            logger.info("Gemini API configured and tested successfully")
            return model
        except Exception as api_error:
            logger.error(f"Gemini API test failed: {api_error}")
            logger.warning("Falling back to mock evaluation mode")
            return None
            
    except Exception as e:
        logger.error(f"Failed to configure Gemini API: {e}")
        logger.warning("Falling back to mock evaluation mode")
        return None

# Initialize model
model: GeminiModel = configure_gemini()

async def evaluate_quiz(
    quiz_content: str,
    student_answer: str,
    max_points: int = 100
) -> tuple[int, str]:
    """
    Use Gemini AI to evaluate a quiz submission
    Returns: (score, feedback)
    """
    try:
        prompt = f"""
        You are an educational AI evaluator. Evaluate the student's answer based on the quiz content.
        
        Quiz Content:
        {quiz_content}
        
        Student's Answer:
        {student_answer}
          Please evaluate the answer and provide:
        1. A score out of {max_points} points
        2. Detailed feedback explaining the score
        
        Format your response exactly as follows:
        Score: [number]
        Feedback: [your detailed feedback]
        """
        
        if not model:
            logger.warning("Gemini model not available. Using fallback evaluation.")
            return _mock_evaluate_quiz(quiz_content, student_answer, max_points)
        
        response = await model.generate_content_async(prompt)  # type: ignore
        response_text = response.text
        
        # Parse the response
        lines = response_text.split('\n')
        score_line = next(line for line in lines if line.startswith('Score:'))
        score = int(score_line.split(':')[1].strip())
        
        feedback = '\n'.join(lines[lines.index(next(line for line in lines if line.startswith('Feedback:'))):])\
            .replace('Feedback:', '').strip()
        
        return score, feedback
        
    except Exception as e:
        # Log the error and return a mock evaluation
        logger.error(f"Error in Gemini evaluation: {str(e)}")
        return _mock_evaluate_quiz(quiz_content, student_answer, max_points)

def _mock_evaluate_quiz(quiz_content: str, student_answer: str, max_points: int) -> tuple[int, str]:
    """Fallback evaluation when Gemini is not available"""
    # Simple heuristic-based evaluation
    answer_length = len(student_answer.strip())
    word_count = len(student_answer.split())
    
    # Basic scoring based on response quality indicators
    score = 0
    feedback_parts = []
    
    if answer_length < 10:
        score = max_points * 0.2
        feedback_parts.append("⚠️ Response is very brief. Consider providing more detail.")
    elif answer_length < 50:
        score = max_points * 0.5
        feedback_parts.append("📝 Good start, but could be more comprehensive.")
    elif answer_length < 200:
        score = max_points * 0.75
        feedback_parts.append("✅ Well-structured response with good detail.")
    else:
        score = max_points * 0.9
        feedback_parts.append("🌟 Excellent comprehensive response!")
    
    # Bonus points for specific content
    if any(keyword in student_answer.lower() for keyword in ['example', 'because', 'therefore', 'analysis']):
        score = min(max_points, score + max_points * 0.1)
        feedback_parts.append("💡 Good use of examples and reasoning.")
    
    feedback_parts.append(f"📊 Word count: {word_count} | Length: {answer_length} characters")
    feedback_parts.append("🤖 Note: This is a fallback evaluation. Enable Gemini AI for more detailed analysis.")
    
    return int(score), " ".join(feedback_parts)

async def evaluate_multiple_choice(
    correct_answers: list[str],
    student_answers: list[str],
    points_per_question: Optional[int] = None
) -> tuple[int, str]:
    """
    Evaluate multiple choice questions and provide AI-enhanced feedback
    """
    if len(correct_answers) != len(student_answers):
        return 0, "Number of answers doesn't match number of questions"
    
    points_per_q = points_per_question or (100 // len(correct_answers))
    correct_count = sum(1 for ca, sa in zip(correct_answers, student_answers) if ca == sa)
    score = correct_count * points_per_q
    
    try:
        # Use Gemini to generate detailed feedback
        prompt = f"""As an educational evaluator, provide detailed feedback for this multiple choice quiz:
        
        Results Summary:
        - Total Questions: {len(correct_answers)}
        - Correct Answers: {correct_count}
        - Score: {min(score, 100)}%
        
        For each question pair:        Student's answers: {json.dumps(student_answers)}
        Correct answers: {json.dumps(correct_answers)}
        
        Please provide:
        1. A summary of performance
        2. Specific feedback on incorrect answers
        3. Tips for improvement
        Keep the feedback constructive and encouraging.
        """
        
        if not model:
            logger.warning("Gemini model not available. Using fallback evaluation.")
            return _mock_evaluate_multiple_choice(correct_answers, student_answers, points_per_q)
        
        response = await model.generate_content_async(prompt)  # type: ignore
        detailed_feedback = response.text
        
        return min(score, 100), detailed_feedback
        
    except Exception as e:
        # Fallback to mock evaluation if AI fails
        logger.error(f"Error in Gemini multiple choice evaluation: {str(e)}")
        return _mock_evaluate_multiple_choice(correct_answers, student_answers, points_per_q)

def _mock_evaluate_multiple_choice(correct_answers: list[str], student_answers: list[str], points_per_question: int) -> tuple[int, str]:
    """Fallback multiple choice evaluation"""
    correct_count = sum(1 for ca, sa in zip(correct_answers, student_answers) if ca == sa)
    score = correct_count * points_per_question
    total_questions = len(correct_answers)
    
    feedback_parts = [
        f"🎯 Score: {correct_count}/{total_questions} correct answers",
        f"📊 Percentage: {(correct_count/total_questions)*100:.1f}%"
    ]
    
    if correct_count == total_questions:
        feedback_parts.append("🏆 Perfect score! Excellent work!")
    elif correct_count >= total_questions * 0.8:
        feedback_parts.append("⭐ Great job! Very strong performance.")
    elif correct_count >= total_questions * 0.6:
        feedback_parts.append("👍 Good work! Room for improvement.")
    else:
        feedback_parts.append("📚 Consider reviewing the material for better understanding.")
    
    feedback_parts.append("🤖 Note: This is a basic evaluation. Enable Gemini AI for detailed analysis.")
    
    return score, " ".join(feedback_parts)

async def evaluate_code(
    problem_description: str,
    test_cases: List[Dict[str, Any]],
    student_code: str,
    language: str
) -> tuple[int, str]:
    """
    Evaluate a code submission using Gemini AI.
    Returns a tuple of (score, feedback).
    """
    try:
        prompt = f"""As a coding evaluator, evaluate this {language} code submission:
        
        Problem Description:
        {problem_description}
        
        Student's Code:
        ```{language}
        {student_code}
        ```
        
        Test Cases:
        {json.dumps(test_cases, indent=2)}
        
        Please evaluate:
        1. Correctness (does it solve the problem?)        2. Code quality (style, efficiency, readability)
        3. Test case performance
        4. Error handling and edge cases
        
        Provide your response in the following format:
        Score: [0-100]
        Feedback: [detailed analysis and suggestions]
        """
        
        if not model:
            logger.warning("Gemini model not available. Using fallback evaluation.")
            return _mock_evaluate_code(problem_description, test_cases, student_code, language)
        
        response = await model.generate_content_async(prompt)  # type: ignore
        response_text = response.text
        
        # Parse the response
        lines = response_text.split('\n')
        score_line = next(line for line in lines if line.startswith('Score:'))
        score = int(score_line.split(':')[1].strip())
        
        feedback = '\n'.join(lines[lines.index(next(line for line in lines if line.startswith('Feedback:'))):])\
            .replace('Feedback:', '').strip()
        
        return score, feedback
        
    except Exception as e:
        logger.error(f"Error in Gemini code evaluation: {str(e)}")
        return _mock_evaluate_code(problem_description, test_cases, student_code, language)

def _mock_evaluate_code(problem_description: str, test_cases: List[Dict[str, Any]], student_code: str, language: str) -> tuple[int, str]:
    """Fallback code evaluation when Gemini is not available"""
    code_length = len(student_code.strip())
    lines_count = len(student_code.split('\n'))
    
    score = 50  # Base score
    feedback_parts = []
    
    # Basic code quality checks
    if code_length < 20:
        score -= 20
        feedback_parts.append("⚠️ Code seems too short to be a complete solution.")
    else:
        feedback_parts.append("✅ Code has reasonable length.")
    
    # Check for common good practices
    if any(keyword in student_code.lower() for keyword in ['def ', 'function', 'class']):
        score += 10
        feedback_parts.append("👍 Good use of functions/classes.")
    
    if '//' in student_code or '#' in student_code or '/*' in student_code:
        score += 10
        feedback_parts.append("📝 Good documentation with comments.")
    
    if any(keyword in student_code.lower() for keyword in ['try', 'catch', 'except', 'error']):
        score += 10
        feedback_parts.append("🛡️ Good error handling practices.")
    
    # Language-specific checks
    if language == 'python':
        if 'import' in student_code:
            score += 5
            feedback_parts.append("📦 Uses appropriate imports.")
    elif language == 'javascript':
        if 'const' in student_code or 'let' in student_code:
            score += 5
            feedback_parts.append("🔧 Uses modern JavaScript syntax.")
    
    # Ensure score is within bounds
    score = max(0, min(100, score))
    
    feedback_parts.extend([
        f"📊 Code metrics: {lines_count} lines, {code_length} characters",
        f"🔧 Language: {language.title()}",
        "🤖 Note: This is a basic evaluation. Enable Gemini AI for detailed code analysis."
    ])
    
    return score, " ".join(feedback_parts)
