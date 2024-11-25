from firebase_functions import https_fn
from firebase_admin import initialize_app, db
from openai import OpenAI
import json
from datetime import datetime
import os

# Initialize Firebase Admin
initialize_app()

@https_fn.on_call()
def create_pbt_conceptualization(req: https_fn.Request) -> https_fn.Response:
    """Create PBT conceptualization and store in Firebase."""
    try:
        # Get data from request
        data = req.data
        conversation = data.get('conversation')
        client_id = data.get('clientId')
        session_number = data.get('sessionNumber')

        print(f"Received request: client={client_id}, session={session_number}")  # Debug log

        if not all([conversation, client_id, session_number]):
            raise ValueError("Missing required parameters")

        try:
            # Initialize OpenAI client inside the function
            openai_client = OpenAI(
                api_key=os.environ.get('OPENAI_API_KEY')
            )
            print("OpenAI client initialized")  # Debug log
        except Exception as e:
            print(f"OpenAI initialization error: {str(e)}")  # Debug log
            raise

        try:
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
                response_format={ "type": "json_object" }  # Simplified format
            )
            print("OpenAI response received")  # Debug log
        except Exception as e:
            print(f"OpenAI request error: {str(e)}")  # Debug log
            raise

        # Parse the response
        analysis_result = json.loads(response.choices[0].message.content)
        print("Response parsed successfully")  # Debug log

        try:
            # Store in Firebase Realtime Database
            ref = db.reference(f'conceptualizations/{client_id}/sessions/{session_number}')
            ref.set({
                'timestamp': datetime.now().isoformat(),
                'modality': 'PBT',
                'analysis': analysis_result
            })
            print("Data written to database")  # Debug log
        except Exception as e:
            print(f"Database write error: {str(e)}")  # Debug log
            raise

        return https_fn.Response(
            json.dumps({
                'success': True,
                'data': analysis_result
            }),
            status=200,
            content_type='application/json'
        )

    except Exception as e:
        print(f"Function error: {str(e)}")  # Debug log
        return https_fn.Response(
            json.dumps({
                'success': False,
                'error': str(e)
            }),
            status=500,
            content_type='application/json'
        )