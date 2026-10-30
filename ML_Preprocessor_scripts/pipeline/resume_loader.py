"""
Utility functions for loading user resume files
"""
from pathlib import Path
import os


def get_resume_file(user_resumes_dir: str = None) -> str:
    """
    Find and return the first PDF file in the user_resumes folder.
    
    Args:
        user_resumes_dir: Path to user_resumes folder. Defaults to ML_Preprocessor_scripts/user_resumes
        
    Returns:
        Full path to the resume PDF file
        
    Raises:
        FileNotFoundError: If no PDF file is found in the folder
        
    Examples:
        >>> resume_path = get_resume_file()
        >>> # Returns: /path/to/user_resumes/my_resume.pdf
    """
    
    if user_resumes_dir is None:
        # Default: go up one level from pipeline folder to ML_Preprocessor_scripts, then to user_resumes
        ml_scripts_dir = Path(__file__).parent.parent  # ML_Preprocessor_scripts
        user_resumes_dir = ml_scripts_dir / "user_resumes"
    else:
        user_resumes_dir = Path(user_resumes_dir)
    
    if not user_resumes_dir.exists():
        raise FileNotFoundError(
            f"User resumes folder not found: {user_resumes_dir}\n"
            f"Please create it or provide the correct path."
        )
    
    # Find all PDF files
    pdf_files = list(user_resumes_dir.glob("*.pdf"))
    
    if not pdf_files:
        raise FileNotFoundError(
            f"No PDF files found in {user_resumes_dir}\n"
            f"Please upload a resume PDF file to this folder.\n"
            f"Supported names: any_name.pdf (e.g., my_resume.pdf, John_Doe.pdf, etc.)"
        )
    
    # Return the first PDF found (or you could let user choose)
    resume_path = str(pdf_files[0])
    print(f"[resume_loader] Using resume: {pdf_files[0].name}")
    return resume_path


def list_available_resumes(user_resumes_dir: str = None) -> list:
    """
    List all PDF files available in the user_resumes folder.
    
    Args:
        user_resumes_dir: Path to user_resumes folder
        
    Returns:
        List of PDF file names
    """
    if user_resumes_dir is None:
        user_resumes_dir = Path(__file__).parent / "user_resumes"
    else:
        user_resumes_dir = Path(user_resumes_dir)
    
    pdf_files = list(user_resumes_dir.glob("*.pdf"))
    return [f.name for f in pdf_files]
