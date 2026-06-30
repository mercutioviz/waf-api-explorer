from flask import Flask, jsonify, send_file, send_from_directory, request
from flask_cors import CORS
import os
from config import config
from waf_api_handler import waf_handler

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})  # Enable CORS for all routes

# Route index
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

# Route other paths
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# Quick ping test
@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({'message': 'WAF API backend is alive'}), 200

# Serve combined Swagger spec
@app.route('/spec', methods=['GET'])
def get_spec():
    spec_path = os.path.join(os.path.dirname(__file__), 'combined_waf_api.json')
    try:
        return send_file(spec_path, mimetype='application/json')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Configuration endpoints
@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current WAF configuration (without sensitive data)"""
    return jsonify(config.to_dict(include_token=False)), 200

@app.route('/api/config', methods=['POST'])
def update_config():
    """Update WAF configuration"""
    try:
        config_data = request.get_json()
        if not config_data:
            return jsonify({'error': 'No configuration data provided'}), 400
        
        config.update_from_dict(config_data)
        return jsonify({
            'message': 'Configuration updated successfully',
            'config': config.to_dict(include_token=False)
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/config/test', methods=['GET'])
def test_connection():
    """Test connection to WAF API"""
    response_data, status_code = waf_handler.test_connection()
    return jsonify(response_data), status_code

@app.route('/api/login', methods=['POST'])
def login():
    """
    Login to WAF with username/password and retrieve token
    
    Expected JSON body:
    {
        "host": "waf.example.com",
        "port": 8000,
        "protocol": "http",
        "username": "wafapi",
        "password": "wafapiadmin"
    }
    """
    try:
        login_data = request.get_json()
        if not login_data:
            return jsonify({'error': 'No login data provided'}), 400
        
        # Validate required fields
        required_fields = ['host', 'username', 'password']
        missing_fields = [field for field in required_fields if field not in login_data]
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'missing': missing_fields
            }), 400
        
        # Set defaults for optional fields
        host = login_data['host']
        port = login_data.get('port', 8000)
        protocol = login_data.get('protocol', 'http')
        username = login_data['username']
        password = login_data['password']
        
        # Attempt login
        response_data, status_code = waf_handler.login(
            host=host,
            port=port,
            protocol=protocol,
            username=username,
            password=password
        )
        
        return jsonify(response_data), status_code
        
    except Exception as e:
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

# WAF API proxy endpoints
@app.route('/api/waf/<path:endpoint>', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def proxy_waf_request(endpoint):
    """
    Proxy requests to the WAF API
    
    This endpoint forwards requests to the Barracuda WAF appliance
    and returns the response.
    """
    try:
        # Get request data
        method = request.method
        params = request.args.to_dict() if request.args else None
        
        # Only get JSON data for methods that support request body
        data = None
        if method in ['POST', 'PUT', 'PATCH']:
            # Try to get JSON data, but don't fail if it's not present
            try:
                data = request.get_json(silent=True)
            except Exception:
                data = None
        
        # Log the request details
        app.logger.info(f"Proxying {method} request to endpoint: {endpoint}")
        if params:
            app.logger.info(f"Query params: {params}")
        if data:
            app.logger.info(f"Request body: {data}")
        
        # Make request to WAF
        response_data, status_code = waf_handler.make_request(
            method=method,
            endpoint=endpoint,
            params=params,
            data=data
        )
        
        return jsonify(response_data), status_code
        
    except Exception as e:
        app.logger.error(f"Error in proxy_waf_request: {str(e)}")
        return jsonify({
            'error': 'Internal server error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
