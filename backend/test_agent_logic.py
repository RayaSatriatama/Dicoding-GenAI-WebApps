
import json
from agents.langgraph_agent import LangGraphQuestionAgent

def test_matching_logic():
    agent = LangGraphQuestionAgent()
    
    # Mock data from AI
    raw_data = {
        "questions": [
            {
                "id": "q1",
                "type": "matching",
                "question": "Match the following:",
                "matching_pairs": [
                    {"left": "Python", "right": "Programming Language"},
                    {"left": "React", "right": "UI Library"},
                    {"left": "MongoDB", "right": "NoSQL Database"}
                ],
                "explanation": "Test explanation"
            }
        ]
    }
    
    # Process
    processed = agent._save_questions_from_json(raw_data, "test-session")
    
    print("PROCESSED QUESTIONS:")
    print(json.dumps(processed, indent=2))
    
    q = processed[0]
    assert q["type"] == "matching"
    assert "items" in q
    assert "matches" in q
    assert q["items"][0]["id"] == "1"
    assert q["matches"][0]["id"] == "A"
    assert q["correct_answer"] == {"1": "A", "2": "B", "3": "C"}
    print("\n✅ Matching Logic Test Passed!")

if __name__ == "__main__":
    test_matching_logic()
