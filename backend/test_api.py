from gradio_client import Client

c = Client('http://localhost:7860')

# Login first
print("Logging in...")
login_result = c.predict('admin', 'admin', api_name='/login_1')
print(f"Login result: {login_result}")

# Try submit_msg
print("\nTrying submit_msg...")
chat_input = {'text': 'Hello, who are you?', 'files': []}
result = c.predict(
    chat_input=chat_input,
    chat_history=[],
    conv_name=None,
    first_selector_choices=[],
    api_name='/submit_msg'
)
print(f"Submit result type: {type(result)}")
print(f"Submit result: {result}")

# Then try chat_fn to get response
print("\nTrying chat_fn...")
chat_result = c.predict(
    chat_history=result if isinstance(result, list) else [[chat_input['text'], None]],
    api_name='/chat_fn'
)
print(f"Chat result: {chat_result}")
