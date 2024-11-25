from firebase_functions import https_fn
from firebase_admin import initialize_app, db
from openai import OpenAI
import json
from datetime import datetime
import os

# Initialize Firebase Admin
initialize_app()

@https_fn.on_call()
def create_pbt_conceptualization(req: https_fn.Request):
    """Create PBT conceptualization and store in Firebase."""
    try:
        # Debug: Print all environment variables
        print("All environment variables:", dict(os.environ))
        
        # Get data from request
        data = req.data
        conversation = data.get('conversation')
        client_id = data.get('clientId')
        session_number = data.get('sessionNumber')

        print(f"Received request: client={client_id}, session={session_number}")  # Debug log

        if not all([conversation, client_id, session_number]):
            return {"success": False, "error": "Missing required parameters"}

        try:
            # Get API key from environment
            api_key = os.environ.get('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable is not set")
            
            openai_client = OpenAI(
                api_key=api_key
            )
            print("OpenAI client initialized")  # Debug log
        except Exception as e:
            print(f"OpenAI initialization error: {str(e)}")  # Debug log
            return {"success": False, "error": str(e)}

        try:
            # Create OpenAI request
            response = openai_client.chat.completions.create(
                model="gpt-4o",
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
            return {"success": False, "error": str(e)}

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
            return {"success": False, "error": str(e)}

        return {"success": True, "data": analysis_result}

    except Exception as e:
        print(f"Function error: {str(e)}")  # Debug log
        return {"success": False, "error": str(e)}