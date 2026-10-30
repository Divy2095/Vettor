"""
Tag-based matching module for improved question relevance.
Matches user skills to question tags and boosts relevance scores.
"""

from typing import List, Dict, Set
import json
from pathlib import Path


class TagMatcher:
    """
    Matches user skills to question tags for better relevance ranking.
    """
    
    def __init__(self):
        self.questions = self._load_questions()
        
    def _load_questions(self) -> List[Dict]:
        """Load questions with tags from JSON"""
        data_dir = Path(__file__).parent.parent / "data"
        questions_path = data_dir / "questions.json"
        
        if not questions_path.exists():
            return []
        
        with open(questions_path) as f:
            return json.load(f)
    
    def calculate_tag_overlap(
        self, 
        user_skills: List[str], 
        question_tags: List[str]
    ) -> float:
        """
        Calculate tag overlap between user skills and question tags.
        Returns: float between 0 and 1 (proportion of matching tags)
        
        Args:
            user_skills: List of user's technical skills (extracted from resume)
            question_tags: List of tags for a question
        
        Returns:
            Overlap score (0.0 = no match, 1.0 = perfect match)
        """
        if not question_tags:
            return 0.0
        
        user_skills_lower = {s.lower() for s in user_skills}
        question_tags_lower = {t.lower() for t in question_tags}
        
        # Calculate intersection
        matches = user_skills_lower & question_tags_lower
        
        # Return proportion of question tags that were matched
        overlap = len(matches) / len(question_tags_lower)
        return round(overlap, 3)
    
    def boost_results_by_tags(
        self,
        results: List[Dict],
        user_skills: List[str],
        tag_weight: float = 0.3,
        semantic_weight: float = 0.7
    ) -> List[Dict]:
        """
        Boost relevance scores based on tag matches.
        Combines semantic similarity with tag-based matching.
        
        Args:
            results: List of search results from FAISS
            user_skills: List of user's extracted skills
            tag_weight: Weight for tag matching (0-1)
            semantic_weight: Weight for semantic similarity (0-1)
        
        Returns:
            Results with updated relevance scores
        """
        if not results:
            return results
        
        enhanced_results = []
        
        for result in results:
            semantic_score = result.get("similarity_score", 0.0)
            question_tags = result.get("tags", [])
            
            # Calculate tag overlap
            tag_overlap = self.calculate_tag_overlap(user_skills, question_tags)
            
            # Combine scores
            # Tag overlap boosts the semantic score
            combined_score = (
                semantic_score * semantic_weight +
                tag_overlap * tag_weight
            )
            
            result["tag_overlap"] = tag_overlap
            result["combined_score"] = round(combined_score, 4)
            result["original_score"] = semantic_score
            
            enhanced_results.append(result)
        
        # Sort by combined score
        enhanced_results.sort(
            key=lambda x: x["combined_score"],
            reverse=True
        )
        
        return enhanced_results
    
    def get_matching_tags(
        self,
        user_skills: List[str],
        question_tags: List[str]
    ) -> List[str]:
        """
        Returns which tags from the question matched user skills.
        
        Args:
            user_skills: List of user's extracted skills
            question_tags: List of tags for a question
        
        Returns:
            List of matching tags
        """
        user_skills_lower = {s.lower() for s in user_skills}
        question_tags_lower = {t.lower() for t in question_tags}
        
        matches = user_skills_lower & question_tags_lower
        return list(matches)
    
    def explain_relevance(
        self,
        result: Dict,
        user_skills: List[str]
    ) -> Dict:
        """
        Create a detailed explanation of why a question was recommended.
        
        Args:
            result: A search result
            user_skills: User's extracted skills
        
        Returns:
            Dictionary with explanation details
        """
        question_tags = result.get("tags", [])
        matching_tags = self.get_matching_tags(user_skills, question_tags)
        
        explanation = {
            "question_id": result.get("Sr No", result.get("id", "unknown")),
            "semantic_score": result.get("original_score", result.get("similarity_score", 0.0)),
            "tag_overlap": result.get("tag_overlap", 0.0),
            "combined_score": result.get("combined_score", result.get("similarity_score", 0.0)),
            "matching_tags": matching_tags,
            "total_tags": len(question_tags),
            "reason": self._generate_reason(matching_tags, result)
        }
        
        return explanation
    
    def _generate_reason(self, matching_tags: List[str], result: Dict) -> str:
        """Generate human-readable explanation"""
        if matching_tags:
            tags_str = ", ".join(matching_tags)
            return f"Matches your skills in: {tags_str}"
        else:
            topic = result.get("Topic", result.get("topic", "related content"))
            return f"Semantically similar to {topic} questions you're preparing for"


# Convenience functions
_matcher = None

def get_matcher():
    """Get or create global matcher instance"""
    global _matcher
    if _matcher is None:
        _matcher = TagMatcher()
    return _matcher


def boost_results(
    results: List[Dict],
    user_skills: List[str],
    tag_weight: float = 0.3
) -> List[Dict]:
    """
    Convenience function to boost results by tags.
    
    Args:
        results: FAISS search results
        user_skills: User's extracted skills
        tag_weight: Weight for tag matching (0-1)
    
    Returns:
        Enhanced results with tag-based relevance
    """
    matcher = get_matcher()
    return matcher.boost_results_by_tags(
        results,
        user_skills,
        tag_weight=tag_weight,
        semantic_weight=(1.0 - tag_weight)
    )


def explain_all_results(
    results: List[Dict],
    user_skills: List[str]
) -> List[Dict]:
    """
    Generate detailed explanations for all results.
    
    Args:
        results: Search results
        user_skills: User's skills
    
    Returns:
        Results with detailed explanations
    """
    matcher = get_matcher()
    explanations = []
    
    for result in results:
        explanation = matcher.explain_relevance(result, user_skills)
        explanations.append({
            **result,
            "relevance_explanation": explanation
        })
    
    return explanations
