"""Test script for quiz generation and answer checking."""
import asyncio
import json
from agents.langgraph_agent import get_agent, get_session_questions, reset_agent

async def test():
    reset_agent()
    agent = get_agent()
    print('Agent ready:', agent.is_available())

    session_id = 'session-test-quiz'

    # Generate soal
    print('\n' + '='*60)
    print('=== STEP 1: GENERATE SOAL ===')
    print('='*60)
    result1 = await agent.process_message('buat 2 soal pilihan ganda tentang loop Python', session_id)
    print(result1)

    # Check if JSON is valid
    print('\n' + '='*60)
    print('=== VALIDASI JSON ===')
    print('='*60)
    try:
        parsed = json.loads(result1)
        print("JSON Valid!")
        print(f"Jumlah soal: {len(parsed.get('questions', []))}")
        for q in parsed.get('questions', []):
            print(f"  - {q.get('id')}: {q.get('type')} - Jawaban: {q.get('correct_answer')}")
    except json.JSONDecodeError as e:
        print(f"JSON Invalid: {e}")

    # Answer (if questions exist)
    questions = get_session_questions(session_id)
    if questions:
        print('\n' + '='*60)
        print('=== STEP 2: JAWAB SOAL 1 ===')
        print('='*60)
        correct_ans = questions[0].get('correct_answer', 'A')
        print(f"(Testing with correct answer: {correct_ans})")
        result2 = await agent.process_message(f'jawab 1 {correct_ans}', session_id)
        print(result2)

if __name__ == "__main__":
    asyncio.run(test())
