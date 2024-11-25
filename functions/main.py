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

        # First, create/update the client and session structure
        try:
            ref = db.reference(f'conceptualizations/{client_id}/sessions/{session_number}')
            ref.set({
                'timestamp': datetime.now().isoformat(),
                'status': 'processing'
            })
        except Exception as e:
            print(f"Database initialization error: {str(e)}")
            return {"success": False, "error": str(e)}

        try:
            # Initialize OpenAI client
            openai_client = OpenAI(
                api_key=OPENAI_API_KEY.value
            )
            print("OpenAI client initialized")
            
            # Get OpenAI analysis
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
                        
                        For each identified element, create a node. Use the language of the conversation to label the node. Then identify connections between these nodes, 
                        including the strength of connection (1-5, where 5 is strongest) and whether it's bidirectional.
                        Each node should have a unique ID and be categorized into one of the above categories. You should optimize the nuber of nodes and edges for clarity of conceptualization but also strive not to lose any important details.
                        
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
            
            # Parse the response
            analysis = json.loads(response.choices[0].message.content)
            
            # Store the analysis in Firebase
            ref.update({
                'status': 'completed',
                'nodes': analysis['nodes'],
                'edges': analysis['edges'],
                'raw_conversation': conversation
            })
            
            return {"success": True, "message": "Analysis stored successfully"}
            
        except Exception as e:
            ref.update({'status': 'error', 'error_message': str(e)})
            print(f"OpenAI/Storage error: {str(e)}")
            return {"success": False, "error": str(e)}

    except Exception as e:
        print(f"Function error: {str(e)}")
        return {"success": False, "error": str(e)}