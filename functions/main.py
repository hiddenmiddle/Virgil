import firebase_functions as functions
import firebase_admin
from firebase_admin import credentials, db
from openai import OpenAI
import json
from datetime import datetime
import os

# Initialize Firebase Admin
firebase_admin.initialize_app()

@functions.https_fn.on_call()
def create_pbt_conceptualization(req: functions.https_fn.Request) -> functions.https_fn.Response:
    """Create PBT conceptualization and store in Firebase."""
    try:
        # Initialize OpenAI client inside the function
        openai_client = OpenAI(
            api_key=os.environ.get('OPENAI_API_KEY')
        )

        # Get data from request
        data = req.data
        conversation = data.get('conversation')
        client_id = data.get('clientId')
        session_number = data.get('sessionNumber')

        if not all([conversation, client_id, session_number]):
            raise ValueError("Missing required parameters")

        # Create OpenAI request
        response = openai_client.chat.completions.create(
            model="gpt-4-0125-preview",
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert in process-based therapy analysis. 
                    Analyze the conversation and identify elements that fit into these categories:
                    - Attentional processes
                    - Cognitive sphere
                    - Affective sphere
                    - Selfing
                    - Motivation
                    - Overt behavior
                    - Biophysiological context
                    - Situational context
                    - Personal history
                    - Broader socio-cultural and economical context"""
                },
                {
                    "role": "user",
                    "content": conversation
                }
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "type": "object",
                    "properties": {
                        "nodes": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "category": {"type": "string"},
                                    "content": {"type": "string"}
                                }
                            }
                        },
                        "links": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "source_id": {"type": "string"},
                                    "target_id": {"type": "string"},
                                    "importance": {"type": "integer"},
                                    "bidirectional": {"type": "boolean"}
                                }
                            }
                        }
                    }
                }
            }
        )

        # Parse the response
        analysis_result = json.loads(response.choices[0].message.content)

        # Store in Firebase Realtime Database
        ref = db.reference(f'conceptualizations/{client_id}/sessions/{session_number}')
        ref.set({
            'timestamp': datetime.now().isoformat(),
            'modality': 'PBT',
            'analysis': analysis_result
        })

        return functions.https_fn.Response(
            json.dumps({'success': True, 'data': analysis_result}),
            status=200,
            content_type='application/json'
        )

    except Exception as e:
        return functions.https_fn.Response(
            json.dumps({'success': False, 'error': str(e)}),
            status=500,
            content_type='application/json'
        )