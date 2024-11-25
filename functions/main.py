from firebase_functions import https_fn
from firebase_functions.params import StringParam
from firebase_admin import initialize_app, db
from openai import OpenAI
import json
from datetime import datetime

# Initialize Firebase Admin
initialize_app()

# Define the OpenAI API key parameter
OPENAI_API_KEY = StringParam("OPENAI_API_KEY", 
    description="OpenAI API key for making completions requests")

@https_fn.on_call()
def create_pbt_conceptualization(req: https_fn.Request):
    """Create PBT conceptualization and store in Firebase."""
    try:
        # Get data from request
        data = req.data
        conversation = data.get('conversation')
        client_id = data.get('clientId')
        session_number = data.get('sessionNumber')

        print(f"Received request: client={client_id}, session={session_number}")

        if not all([conversation, client_id, session_number]):
            return {"success": False, "error": "Missing required parameters"}

        try:
            # Initialize OpenAI client with the parameter value
            openai_client = OpenAI(
                api_key=OPENAI_API_KEY.value
            )
            print("OpenAI client initialized")
        except Exception as e:
            print(f"OpenAI initialization error: {str(e)}")
            return {"success": False, "error": str(e)}

        try:
            # Create OpenAI request
            response = openai_client.chat.completions.create(
                model="gpt-4o",
                response_format={ "type": "json_object" },
                messages=[
                    {"role": "system", "content": """You are an expert in process-based therapy analysis. Analyze the conversation and identify elements that fit into these categories:
                        - Attentional processes
                        - Cognitive sphere
                        - Affective sphere
                        - Selfing
                        - Motivation
                        - Overt behavior
                        - Biophysiological context
                        - Situational context
                        - Personal history
                        - Broader socio-cultural and economical context
                        
                        For each identified element, create a node. Then identify connections between these nodes, 
                        including the strength of connection (1-5, where 5 is strongest) and whether it's bidirectional.
                        Each node should have a unique ID and be categorized into one of the above categories.
                        
                        Return the analysis in this JSON structure:
                        {
                            "nodes": [
                                {
                                    "id": "unique_identifier",
                                    "label": "descriptive text of the element",
                                    "category": "one of the categories listed above"
                                }
                            ],
                            "edges": [
                                {
                                    "from": "source_node_id",
                                    "to": "target_node_id",
                                    "strength": "number 1-5",
                                    "bidirectional": true/false
                                }
                            ]
                        }"""},
                    {"role": "user", "content": f"Please analyze this therapy conversation and provide a detailed process-based therapy analysis in the specified JSON format: {conversation}"}
                ]
            )
            print("OpenAI response received")
            
            # Extract the response content
            analysis = response.choices[0].message.content
            return {"success": True, "analysis": analysis}
            
        except Exception as e:
            print(f"OpenAI request error: {str(e)}")
            return {"success": False, "error": str(e)}

    except Exception as e:
        print(f"Function error: {str(e)}")
        return {"success": False, "error": str(e)}